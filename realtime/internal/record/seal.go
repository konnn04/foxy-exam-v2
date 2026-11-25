package record

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

// Sealed objects: AES-256-GCM in independent 64 KiB chunks, so a player can seek (HTTP Range) without decrypting the
// whole file, and any change (a flipped byte, a dropped or reordered chunk, a cut tail) fails authentication.
//
//	header : "FXE1" | 8-byte random nonce prefix
//	chunk i: GCM(plaintext[i*64K : (i+1)*64K]) with nonce = prefix | uint32(i), AAD = uint32(i) | last-flag
//
// Every exam has its own random data key; only its wrapped form (sealed with the master key from the environment) is
// stored. Losing the master key makes every sealed file unreadable: back it up.
const (
	sealMagic    = "FXE1"
	sealChunk    = 64 << 10
	sealHeader   = len(sealMagic) + 8
	sealOverhead = 16 // GCM tag
	sealedSuffix = ".fxe"
)

var errSealed = errors.New("sealed object is corrupt or was tampered with")

func newGCM(key []byte) (cipher.AEAD, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("seal: key must be 32 bytes, got %d", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func chunkNonce(prefix []byte, i uint32) []byte {
	n := make([]byte, 12)
	copy(n, prefix)
	binary.BigEndian.PutUint32(n[8:], i)
	return n
}

func chunkAAD(i uint32, last bool) []byte {
	a := make([]byte, 5)
	binary.BigEndian.PutUint32(a, i)
	if last {
		a[4] = 1
	}
	return a
}

func readChunk(r io.Reader, buf []byte) (int, error) {
	n, err := io.ReadFull(r, buf)
	if err == io.EOF || err == io.ErrUnexpectedEOF {
		return n, nil
	}
	return n, err
}

// sealStream encrypts src into dst and returns the plaintext size.
func sealStream(dst io.Writer, src io.Reader, key []byte) (int64, error) {
	aead, err := newGCM(key)
	if err != nil {
		return 0, err
	}
	prefix := make([]byte, 8)
	if _, err := rand.Read(prefix); err != nil {
		return 0, err
	}
	if _, err := dst.Write(append([]byte(sealMagic), prefix...)); err != nil {
		return 0, err
	}
	cur, next := make([]byte, sealChunk), make([]byte, sealChunk)
	n, err := readChunk(src, cur)
	if err != nil {
		return 0, err
	}
	var total int64
	for i := uint32(0); ; i++ {
		m, err := readChunk(src, next) // one chunk of look-ahead: the last chunk is marked as such
		if err != nil {
			return 0, err
		}
		last := m == 0
		if _, err := dst.Write(aead.Seal(nil, chunkNonce(prefix, i), cur[:n], chunkAAD(i, last))); err != nil {
			return 0, err
		}
		total += int64(n)
		if last {
			return total, nil
		}
		cur, next, n = next, cur, m
	}
}

// sealedReader decrypts a sealed object on demand (io.ReaderAt over the plaintext).
type sealedReader struct {
	src    io.ReaderAt
	aead   cipher.AEAD
	prefix []byte
	chunks int
	plain  int64
	ctLast int64 // ciphertext length of the last chunk
	cached int
	buf    []byte
}

func openSealed(src io.ReaderAt, size int64, key []byte) (*sealedReader, error) {
	aead, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	head := make([]byte, sealHeader)
	if _, err := src.ReadAt(head, 0); err != nil || string(head[:4]) != sealMagic {
		return nil, errSealed
	}
	body := size - int64(sealHeader)
	full := int64(sealChunk + sealOverhead)
	if body < sealOverhead {
		return nil, errSealed
	}
	chunks := int((body + full - 1) / full)
	ctLast := body - int64(chunks-1)*full
	if ctLast < sealOverhead {
		return nil, errSealed
	}
	plain := int64(chunks-1)*sealChunk + ctLast - sealOverhead
	return &sealedReader{src: src, aead: aead, prefix: head[4:], chunks: chunks, plain: plain, ctLast: ctLast, cached: -1}, nil
}

func (s *sealedReader) Size() int64 { return s.plain }

func (s *sealedReader) chunk(i int) ([]byte, error) {
	if i == s.cached {
		return s.buf, nil
	}
	full := int64(sealChunk + sealOverhead)
	n := full
	if i == s.chunks-1 {
		n = s.ctLast
	}
	ct := make([]byte, n)
	if _, err := s.src.ReadAt(ct, int64(sealHeader)+int64(i)*full); err != nil && err != io.EOF {
		return nil, err
	}
	pt, err := s.aead.Open(nil, chunkNonce(s.prefix, uint32(i)), ct, chunkAAD(uint32(i), i == s.chunks-1))
	if err != nil {
		return nil, errSealed
	}
	s.cached, s.buf = i, pt
	return pt, nil
}

func (s *sealedReader) ReadAt(p []byte, off int64) (int, error) {
	if off >= s.plain {
		return 0, io.EOF
	}
	n := 0
	for n < len(p) && off < s.plain {
		i := int(off / sealChunk)
		pt, err := s.chunk(i)
		if err != nil {
			return n, err
		}
		c := copy(p[n:], pt[off-int64(i)*sealChunk:])
		n += c
		off += int64(c)
	}
	if n < len(p) {
		return n, io.EOF
	}
	return n, nil
}

// wrapKey seals a data key with the master key: base64(nonce | GCM(dataKey)).
func wrapKey(master, dataKey []byte) (string, error) {
	aead, err := newGCM(master)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, 12)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(append(nonce, aead.Seal(nil, nonce, dataKey, []byte("foxy-exam-key"))...)), nil
}

func unwrapKey(master []byte, wrapped string) ([]byte, error) {
	aead, err := newGCM(master)
	if err != nil {
		return nil, err
	}
	raw, err := base64.StdEncoding.DecodeString(wrapped)
	if err != nil || len(raw) < 12+sealOverhead {
		return nil, errSealed
	}
	k, err := aead.Open(nil, raw[:12], raw[12:], []byte("foxy-exam-key"))
	if err != nil {
		return nil, errors.New("seal: the master key does not open this exam key (wrong RECORD_SEAL_KEY?)")
	}
	return k, nil
}
