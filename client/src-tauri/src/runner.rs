//! Runs the candidate's code with the tool chain installed on THEIR machine (g++, clang++, MSVC, Python, Java).
//!
//! Nothing is uploaded: the source goes to a throw-away directory, is compiled and run with a time limit and
//! capped output, and the directory is removed. Grading still happens on the server; this is only "Chạy thử".

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use tauri::Emitter;

const OUTPUT_CAP: usize = 64 * 1024;
const COMPILE_TIMEOUT: Duration = Duration::from_secs(40);

#[cfg(windows)]
fn quiet(cmd: &mut Command) -> &mut Command {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000) // CREATE_NO_WINDOW
}
#[cfg(not(windows))]
fn quiet(cmd: &mut Command) -> &mut Command {
    cmd
}

#[derive(Serialize, Clone)]
pub struct Toolchain {
    /// stable id sent back by the UI: "g++", "clang++", "msvc", "python", "java"
    pub id: String,
    pub language: String, // cpp | python | java
    pub label: String,
    pub version: String,
}

fn which(name: &str) -> Option<PathBuf> {
    let paths = std::env::var_os("PATH")?;
    let exts: Vec<String> = if cfg!(windows) {
        std::env::var("PATHEXT")
            .unwrap_or(".EXE;.CMD;.BAT".into())
            .split(';')
            .map(|s| s.to_lowercase())
            .collect()
    } else {
        vec![String::new()]
    };
    for dir in std::env::split_paths(&paths) {
        for ext in &exts {
            let p = dir.join(format!("{name}{ext}"));
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

fn first_line(cmd: &Path, args: &[&str]) -> String {
    let mut c = Command::new(cmd);
    c.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    quiet(&mut c);
    c.output()
        .ok()
        .map(|o| {
            let s = if o.stdout.is_empty() { o.stderr } else { o.stdout };
            String::from_utf8_lossy(&s).lines().next().unwrap_or("").trim().to_string()
        })
        .unwrap_or_default()
}

/// `vcvars64.bat` of the newest Visual Studio with the C++ tools, if any.
#[cfg(windows)]
fn msvc_vcvars() -> Option<PathBuf> {
    let pf = std::env::var("ProgramFiles(x86)").ok()?;
    let vswhere = Path::new(&pf).join("Microsoft Visual Studio/Installer/vswhere.exe");
    if !vswhere.is_file() {
        return None;
    }
    let mut c = Command::new(vswhere);
    c.args([
        "-latest",
        "-products",
        "*",
        "-requires",
        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
        "-property",
        "installationPath",
    ])
    .stdout(Stdio::piped());
    quiet(&mut c);
    let out = c.output().ok()?;
    let root = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if root.is_empty() {
        return None;
    }
    let bat = Path::new(&root).join("VC/Auxiliary/Build/vcvars64.bat");
    bat.is_file().then_some(bat)
}
#[cfg(not(windows))]
fn msvc_vcvars() -> Option<PathBuf> {
    None
}

fn toolchain(id: &str, language: &str, label: &str, bin: Option<PathBuf>, args: &[&str]) -> Option<Toolchain> {
    bin.map(|b| Toolchain { id: id.into(), language: language.into(), label: label.into(), version: first_line(&b, args) })
}

#[tauri::command]
pub fn runner_toolchains() -> Vec<Toolchain> {
    let py = which("python").or_else(|| which("python3")).or_else(|| which("py"));
    let mut out: Vec<Toolchain> = [
        toolchain("g++", "cpp", "g++ (GCC)", which("g++"), &["--version"]),
        toolchain("clang++", "cpp", "clang++", which("clang++"), &["--version"]),
    ]
    .into_iter()
    .flatten()
    .collect();
    if msvc_vcvars().is_some() {
        out.push(Toolchain { id: "msvc".into(), language: "cpp".into(), label: "Visual Studio (cl)".into(), version: "MSVC".into() });
    }
    out.extend(toolchain("python", "python", "Python 3", py, &["--version"]));
    if which("javac").is_some() {
        out.extend(toolchain("java", "java", "Java (JDK)", which("java"), &["-version"]));
    }
    out
}

#[derive(Deserialize)]
pub struct RunRequest {
    pub toolchain: String,
    pub source: String,
    #[serde(default)]
    pub stdin: String,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
}
fn default_timeout() -> u64 {
    3000
}

#[derive(Serialize, Default)]
pub struct RunResult {
    /// "ready" | "compile" | "run" | "toolchain"
    pub phase: String,
    pub ok: bool,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
    pub millis: u64,
}

fn read_capped<R: Read + Send + 'static>(mut r: R) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        let mut chunk = [0u8; 8192];
        loop {
            match r.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if buf.len() < OUTPUT_CAP {
                        buf.extend_from_slice(&chunk[..n.min(OUTPUT_CAP - buf.len())]);
                    }
                }
            }
        }
        String::from_utf8_lossy(&buf).into_owned()
    })
}

/// Runs a prepared command with stdin, a wall-clock limit and capped output; kills the process on timeout.
fn exec(mut cmd: Command, stdin: &str, limit: Duration) -> RunResult {
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    quiet(&mut cmd);
    let started = Instant::now();
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => return RunResult { phase: "toolchain".into(), stderr: format!("Không chạy được: {e}"), ..Default::default() },
    };
    if let Some(mut si) = child.stdin.take() {
        let data = stdin.as_bytes().to_vec();
        std::thread::spawn(move || {
            use std::io::Write;
            let _ = si.write_all(&data);
        });
    }
    let out = read_capped(child.stdout.take().unwrap());
    let err = read_capped(child.stderr.take().unwrap());

    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(s)) => break Some(s),
            Ok(None) if started.elapsed() > limit => {
                timed_out = true;
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            Err(_) => break None,
        }
    };
    RunResult {
        phase: "ready".into(),
        ok: status.map(|s| s.success()).unwrap_or(false) && !timed_out,
        exit_code: status.and_then(|s| s.code()),
        stdout: out.join().unwrap_or_default(),
        stderr: err.join().unwrap_or_default(),
        timed_out,
        millis: started.elapsed().as_millis() as u64,
    }
}

fn work_dir() -> std::io::Result<PathBuf> {
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("foxy-run-{nanos}"));
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn fail(phase: &str, msg: String) -> RunResult {
    RunResult { phase: phase.into(), stderr: msg, ..Default::default() }
}

#[tauri::command]
pub async fn runner_run(req: RunRequest) -> RunResult {
    tauri::async_runtime::spawn_blocking(move || run_blocking(req)).await.unwrap_or_else(|e| fail("toolchain", e.to_string()))
}

fn run_blocking(req: RunRequest) -> RunResult {
    let dir = match work_dir() {
        Ok(d) => d,
        Err(e) => return fail("toolchain", format!("Không tạo được thư mục tạm: {e}")),
    };
    let result = run_in(&dir, &req);
    let _ = std::fs::remove_dir_all(&dir);
    result
}

fn compile_step(mut compile: Command, what: &str) -> Option<RunResult> {
    let r = exec_compile(&mut compile);
    if !r.ok {
        return Some(RunResult { phase: "compile".into(), stderr: format!("{what}\n{}{}", r.stdout, r.stderr), ..r });
    }
    None
}

fn exec_compile(cmd: &mut Command) -> RunResult {
    // Command is consumed by exec(); rebuild from the program/args the caller prepared.
    let mut c = Command::new(cmd.get_program());
    c.args(cmd.get_args());
    if let Some(d) = cmd.get_current_dir() {
        c.current_dir(d);
    }
    exec(c, "", COMPILE_TIMEOUT)
}

/// Compiles when the language needs it and returns the command that runs the program (not spawned yet).
fn prepare(dir: &Path, toolchain: &str, source: &str) -> Result<Command, RunResult> {
    let src = |name: &str| -> Result<PathBuf, RunResult> {
        let p = dir.join(name);
        std::fs::write(&p, source).map(|_| p).map_err(|e| fail("toolchain", format!("Không ghi được mã nguồn: {e}")))
    };
    let exe = if cfg!(windows) { "prog.exe" } else { "prog" };

    match toolchain {
        "g++" | "clang++" => {
            let main = src("main.cpp")?;
            let compiler = which(toolchain).unwrap_or_else(|| PathBuf::from(toolchain));
            let mut c = Command::new(compiler);
            c.current_dir(dir).args(["-std=c++17", "-O2", "-o", exe]).arg(&main);
            if let Some(f) = compile_step(c, "Lỗi biên dịch:") {
                return Err(f);
            }
            Ok(Command::new(dir.join(exe)))
        }
        "msvc" => {
            let Some(vcvars) = msvc_vcvars() else { return Err(fail("toolchain", "Không tìm thấy Visual Studio C++ tools.".into())) };
            src("main.cpp")?;
            let mut c = Command::new("cmd");
            c.current_dir(dir).arg("/C").arg(format!(
                "call \"{}\" >nul && cl /nologo /EHsc /std:c++17 /O2 /Fe:{exe} main.cpp",
                vcvars.display()
            ));
            if let Some(f) = compile_step(c, "Lỗi biên dịch (MSVC):") {
                return Err(f);
            }
            Ok(Command::new(dir.join(exe)))
        }
        "python" => {
            let main = src("main.py")?;
            let py = which("python").or_else(|| which("python3")).or_else(|| which("py")).unwrap_or_else(|| PathBuf::from("python"));
            let mut c = Command::new(py);
            c.current_dir(dir).arg("-u").arg("-X").arg("utf8").arg(&main);
            Ok(c)
        }
        "java" => {
            let main = src("Main.java")?;
            let mut c = Command::new(which("javac").unwrap_or_else(|| PathBuf::from("javac")));
            c.current_dir(dir).arg("-encoding").arg("UTF-8").arg(&main);
            if let Some(f) = compile_step(c, "Lỗi biên dịch (javac):") {
                return Err(f);
            }
            let mut r = Command::new(which("java").unwrap_or_else(|| PathBuf::from("java")));
            r.current_dir(dir).args(["-cp", "."]).arg("Main");
            Ok(r)
        }
        other => Err(fail("toolchain", format!("Chưa hỗ trợ trình biên dịch '{other}'."))),
    }
}

fn run_in(dir: &Path, req: &RunRequest) -> RunResult {
    let limit = Duration::from_millis(req.timeout_ms.clamp(500, 20_000));
    match prepare(dir, &req.toolchain, &req.source) {
        Ok(cmd) => exec(cmd, &req.stdin, limit),
        Err(f) => f,
    }
}

// ---------------------------------------------------------------------------------------------
// Interactive sessions: the in-app terminal. The program runs with piped stdio, its output is
// streamed to the window that started it and the candidate types the input there, so no console
// of the machine is ever opened.
// ---------------------------------------------------------------------------------------------

struct Session {
    stdin: Option<std::process::ChildStdin>,
    child: Arc<Mutex<Child>>,
}

static SESSIONS: OnceLock<Mutex<HashMap<u64, Session>>> = OnceLock::new();
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
const SESSION_LIMIT: Duration = Duration::from_secs(15 * 60);

fn sessions() -> &'static Mutex<HashMap<u64, Session>> {
    SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Serialize, Clone)]
struct DataEvent {
    id: u64,
    stream: &'static str,
    text: String,
}

#[derive(Serialize, Clone)]
struct ExitEvent {
    id: u64,
    /// "ready" | "compile" | "toolchain" | "killed" | "timeout"
    phase: String,
    exit_code: Option<i32>,
    millis: u64,
}

fn send_data(window: &tauri::Window, id: u64, stream: &'static str, text: String) {
    let _ = window.emit_to(window.label(), "runner://data", DataEvent { id, stream, text });
}

fn pump<R: Read + Send + 'static>(mut r: R, window: tauri::Window, id: u64, stream: &'static str) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let mut chunk = [0u8; 4096];
        let mut carry: Vec<u8> = Vec::new();
        let mut total = 0usize;
        loop {
            match r.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    total += n;
                    if total > OUTPUT_CAP * 4 {
                        continue; // a runaway program must not flood the window; keep draining so it never blocks
                    }
                    carry.extend_from_slice(&chunk[..n]);
                    // never split a UTF-8 sequence between two events
                    let cut = match std::str::from_utf8(&carry) {
                        Ok(_) => carry.len(),
                        Err(e) => e.valid_up_to(),
                    };
                    if cut > 0 {
                        let text = String::from_utf8_lossy(&carry[..cut]).into_owned();
                        carry.drain(..cut);
                        send_data(&window, id, stream, text);
                    }
                }
            }
        }
    })
}

#[tauri::command]
pub async fn runner_session_start(window: tauri::Window, toolchain: String, source: String) -> Result<u64, String> {
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || {
        let started = Instant::now();
        let finish = |phase: &str, code: Option<i32>| {
            let _ = window.emit_to(
                window.label(),
                "runner://exit",
                ExitEvent { id, phase: phase.into(), exit_code: code, millis: started.elapsed().as_millis() as u64 },
            );
        };
        let dir = match work_dir() {
            Ok(d) => d,
            Err(e) => {
                send_data(&window, id, "stderr", format!("Không tạo được thư mục tạm: {e}\n"));
                return finish("toolchain", None);
            }
        };
        let mut cmd = match prepare(&dir, &toolchain, &source) {
            Ok(c) => c,
            Err(f) => {
                send_data(&window, id, "stderr", format!("{}\n", f.stderr.trim_end()));
                let _ = std::fs::remove_dir_all(&dir);
                return finish(&f.phase, f.exit_code);
            }
        };
        cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).current_dir(&dir);
        quiet(&mut cmd);
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                send_data(&window, id, "stderr", format!("Không chạy được: {e}\n"));
                let _ = std::fs::remove_dir_all(&dir);
                return finish("toolchain", None);
            }
        };
        let stdin = child.stdin.take();
        let out = pump(child.stdout.take().unwrap(), window.clone(), id, "stdout");
        let err = pump(child.stderr.take().unwrap(), window.clone(), id, "stderr");
        let child = Arc::new(Mutex::new(child));
        sessions().lock().unwrap().insert(id, Session { stdin, child: child.clone() });

        let (phase, code) = loop {
            let status = child.lock().unwrap().try_wait();
            match status {
                Ok(Some(s)) => {
                    let alive = sessions().lock().unwrap().contains_key(&id);
                    break (if alive { "ready" } else { "killed" }, s.code());
                }
                Ok(None) if started.elapsed() > SESSION_LIMIT => {
                    let _ = child.lock().unwrap().kill();
                    let _ = child.lock().unwrap().wait();
                    break ("timeout", None);
                }
                Ok(None) => std::thread::sleep(Duration::from_millis(20)),
                Err(_) => break ("toolchain", None),
            }
        };
        let _ = out.join();
        let _ = err.join();
        sessions().lock().unwrap().remove(&id);
        let _ = std::fs::remove_dir_all(&dir);
        finish(phase, code);
    });
    Ok(id)
}

#[tauri::command]
pub fn runner_session_write(id: u64, text: String) -> bool {
    use std::io::Write;
    let mut map = sessions().lock().unwrap();
    match map.get_mut(&id).and_then(|s| s.stdin.as_mut()) {
        Some(si) => si.write_all(text.as_bytes()).and_then(|_| si.flush()).is_ok(),
        None => false,
    }
}

#[tauri::command]
pub fn runner_session_close_stdin(id: u64) {
    if let Some(s) = sessions().lock().unwrap().get_mut(&id) {
        s.stdin = None; // dropping the pipe is end-of-file for the program
    }
}

#[tauri::command]
pub fn runner_session_kill(id: u64) {
    let session = sessions().lock().unwrap().remove(&id);
    if let Some(s) = session {
        let _ = s.child.lock().unwrap().kill();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(toolchain: &str, source: &str, stdin: &str, ms: u64) -> RunResult {
        run_blocking(RunRequest { toolchain: toolchain.into(), source: source.into(), stdin: stdin.into(), timeout_ms: ms })
    }

    fn have(id: &str) -> bool {
        runner_toolchains().iter().any(|t| t.id == id)
    }

    #[test]
    fn python_reads_stdin_and_reports_exit_codes() {
        if !have("python") {
            return;
        }
        let r = run("python", "a, b = map(int, input().split())\nprint(a + b)", "2 3\n", 5000);
        assert!(r.ok, "{}", r.stderr);
        assert_eq!(r.stdout.trim(), "5");

        let bad = run("python", "raise SystemExit(3)", "", 5000);
        assert!(!bad.ok);
        assert_eq!(bad.exit_code, Some(3));
    }

    #[test]
    fn an_endless_loop_is_killed_at_the_time_limit() {
        if !have("python") {
            return;
        }
        let r = run("python", "while True: pass", "", 800);
        assert!(r.timed_out && !r.ok);
        assert!(r.millis < 5000, "took {} ms", r.millis);
    }

    #[test]
    fn cpp_compile_errors_are_separated_from_run_errors() {
        let id = if have("g++") { "g++" } else if have("clang++") { "clang++" } else { return };
        let bad = run(id, "int main( { return 0; }", "", 5000);
        assert_eq!(bad.phase, "compile");
        assert!(!bad.ok);

        let ok = run(id, "#include <iostream>\nint main(){ int a,b; std::cin>>a>>b; std::cout<<a*b; }", "6 7", 5000);
        assert!(ok.ok, "{}", ok.stderr);
        assert_eq!(ok.stdout.trim(), "42");
    }

    #[test]
    fn output_is_capped_and_unknown_toolchains_are_refused() {
        if have("python") {
            let r = run("python", "print('x' * 5_000_000)", "", 8000);
            assert!(r.stdout.len() <= OUTPUT_CAP);
        }
        assert_eq!(run("cobol", "", "", 1000).phase, "toolchain");
    }
}
