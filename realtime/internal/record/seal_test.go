package record

import (
	"bytes"
	"crypto/rand"
	"io"
	"testing"
)

func key32() []byte {
	k := make([]byte, 32)
	_, _ = rand.Read(k)
	return k
}

func TestSealRoundTripAndRandomAccess(t *testing.T) {
	k := key32()
	for _, size := range []int{0, 1, sealChunk - 1, sealChunk, sealChunk + 1, 3*sealChunk + 777} {
		plain := make([]byte, size)
		_, _ = rand.Read(plain)
		var ct bytes.Buffer
		n, err := sealStream(&ct, bytes.NewReader(plain), k)
		if err != nil || n != int64(size) {
			t.Fatalf("size %d: sealed %d, %v", size, n, err)
		}
		r, err := openSealed(bytes.NewReader(ct.Bytes()), int64(ct.Len()), k)
		if err != nil {
			t.Fatalf("size %d: open: %v", size, err)
		}
		if r.Size() != int64(size) {
			t.Fatalf("size %d: plaintext size %d", size, r.Size())
		}
		got, err := io.ReadAll(io.NewSectionReader(r, 0, r.Size()))
		if err != nil || !bytes.Equal(got, plain) {
			t.Fatalf("size %d: round trip mismatch (%v)", size, err)
		}
		if size > 10 {
			off := int64(size / 3)
			part := make([]byte, 7)
			if _, err := r.ReadAt(part, off); err != nil || !bytes.Equal(part, plain[off:off+7]) {
				t.Fatalf("size %d: random access at %d failed: %v", size, off, err)
			}
		}
	}
}

func TestSealDetectsTamperingAndTruncation(t *testing.T) {
	k := key32()
	plain := make([]byte, 3*sealChunk)
	var ct bytes.Buffer
	if _, err := sealStream(&ct, bytes.NewReader(plain), k); err != nil {
		t.Fatal(err)
	}
	read := func(b []byte, key []byte) error {
		r, err := openSealed(bytes.NewReader(b), int64(len(b)), key)
		if err != nil {
			return err
		}
		_, err = io.ReadAll(io.NewSectionReader(r, 0, r.Size()))
		return err
	}
	flipped := append([]byte(nil), ct.Bytes()...)
	flipped[sealHeader+100] ^= 1
	if read(flipped, k) == nil {
		t.Fatal("a flipped byte must be detected")
	}
	cut := ct.Bytes()[:sealHeader+2*(sealChunk+sealOverhead)] // the third chunk dropped
	if read(cut, k) == nil {
		t.Fatal("a truncated file must be detected")
	}
	if read(ct.Bytes(), key32()) == nil {
		t.Fatal("another key must not open it")
	}
}

func TestWrapKey(t *testing.T) {
	master, dk := key32(), key32()
	w, err := wrapKey(master, dk)
	if err != nil {
		t.Fatal(err)
	}
	got, err := unwrapKey(master, w)
	if err != nil || !bytes.Equal(got, dk) {
		t.Fatalf("unwrap: %v", err)
	}
	if _, err := unwrapKey(key32(), w); err == nil {
		t.Fatal("a different master key must not unwrap")
	}
}
