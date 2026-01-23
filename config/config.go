package config

import (
	"fmt"
	"os"
	"path/filepath"
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
	cfg.LogsDir = cfg.getOSLogsDir()
	return cfg
}

func (c *Config) getOSLogsDir() string {
	switch runtime.GOOS {
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			appData = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Roaming")
		}
		return filepath.Join(appData, c.AppName, "logs")

	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			home = "."
		}
		return filepath.Join(home, "Library", "Logs", c.AppName)

	case "linux":
		home, err := os.UserHomeDir()
		if err != nil {
			home = "."
		}

		if xdgData := os.Getenv("XDG_DATA_HOME"); xdgData != "" {
			return filepath.Join(xdgData, c.AppName, "logs")
		}
		return filepath.Join(home, ".local", "share", c.AppName, "logs")

	default:
		return "logs"
	}
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
