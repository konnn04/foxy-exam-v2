//! Runs the candidate's code with the tool chain installed on THEIR machine (g++, clang++, MSVC, Python, Java).
//!
//! Nothing is uploaded: the source goes to a throw-away directory, is compiled and run with a time limit and
//! capped output, and the directory is removed. Grading still happens on the server; this is only "Chạy thử".

use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

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

fn run_in(dir: &Path, req: &RunRequest) -> RunResult {
    let limit = Duration::from_millis(req.timeout_ms.clamp(500, 20_000));
    let src = |name: &str| -> Result<PathBuf, RunResult> {
        let p = dir.join(name);
        std::fs::write(&p, &req.source).map(|_| p).map_err(|e| fail("toolchain", format!("Không ghi được mã nguồn: {e}")))
    };
    let exe = if cfg!(windows) { "prog.exe" } else { "prog" };

    match req.toolchain.as_str() {
        "g++" | "clang++" => {
            let main = match src("main.cpp") {
                Ok(p) => p,
                Err(e) => return e,
            };
            let compiler = which(&req.toolchain).unwrap_or_else(|| PathBuf::from(&req.toolchain));
            let mut c = Command::new(compiler);
            c.current_dir(dir).args(["-std=c++17", "-O2", "-o", exe]).arg(&main);
            if let Some(f) = compile_step(c, "Lỗi biên dịch:") {
                return f;
            }
            exec(Command::new(dir.join(exe)), &req.stdin, limit)
        }
        "msvc" => {
            let Some(vcvars) = msvc_vcvars() else { return fail("toolchain", "Không tìm thấy Visual Studio C++ tools.".into()) };
            if let Err(e) = src("main.cpp") {
                return e;
            }
            let mut c = Command::new("cmd");
            c.current_dir(dir).arg("/C").arg(format!(
                "call \"{}\" >nul && cl /nologo /EHsc /std:c++17 /O2 /Fe:{exe} main.cpp",
                vcvars.display()
            ));
            if let Some(f) = compile_step(c, "Lỗi biên dịch (MSVC):") {
                return f;
            }
            exec(Command::new(dir.join(exe)), &req.stdin, limit)
        }
        "python" => {
            let main = match src("main.py") {
                Ok(p) => p,
                Err(e) => return e,
            };
            let py = which("python").or_else(|| which("python3")).or_else(|| which("py")).unwrap_or_else(|| PathBuf::from("python"));
            let mut c = Command::new(py);
            c.current_dir(dir).arg("-X").arg("utf8").arg(&main);
            exec(c, &req.stdin, limit)
        }
        "java" => {
            let main = match src("Main.java") {
                Ok(p) => p,
                Err(e) => return e,
            };
            let mut c = Command::new(which("javac").unwrap_or_else(|| PathBuf::from("javac")));
            c.current_dir(dir).arg("-encoding").arg("UTF-8").arg(&main);
            if let Some(f) = compile_step(c, "Lỗi biên dịch (javac):") {
                return f;
            }
            let mut r = Command::new(which("java").unwrap_or_else(|| PathBuf::from("java")));
            r.current_dir(dir).args(["-cp", "."]).arg("Main");
            exec(r, &req.stdin, limit)
        }
        other => fail("toolchain", format!("Chưa hỗ trợ trình biên dịch '{other}'.")),
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
