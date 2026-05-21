package config

import (
	"fmt"
	"os"
	"runtime"
)

type Config struct {
	Port    string
	LogsDir string
	AppName string
}

func NewConfig() *Config {
	cfg := &Config{
		Port:    "8091",
		AppName: "WikiGraphExplorer",
	}

	return cfg
}

func (c *Config) CreateLogsDir() error {
	if err := os.MkdirAll(c.LogsDir, 0755); err != nil {
		return fmt.Errorf("failed to create logs directory %s: %v", c.LogsDir, err)
	}
	return nil
}

func (c *Config) String() string {
	return fmt.Sprintf("Config{Port:%s, LogsDir:%s, OS:%s/%s}",
		c.Port, c.LogsDir, runtime.GOOS, runtime.GOARCH)
}
