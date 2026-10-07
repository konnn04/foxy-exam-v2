// devredis: an in-memory Redis for local development on machines without Redis (e.g. Windows).
// NOT for production — data is lost on exit. Usage: go run ./cmd/devredis [addr]   (default 127.0.0.1:6379)
package main

import (
	"fmt"
	"os"
	"os/signal"

	"github.com/alicebob/miniredis/v2"
)

func main() {
	addr := "127.0.0.1:6379"
	if len(os.Args) > 1 {
		addr = os.Args[1]
	}
	m := miniredis.NewMiniRedis()
	if err := m.StartAddr(addr); err != nil {
		fmt.Fprintln(os.Stderr, "devredis:", err)
		os.Exit(1)
	}
	fmt.Println("devredis listening on", m.Addr())
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	<-c
	m.Close()
}
