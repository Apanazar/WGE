package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type LogLevel int

const (
	LEVEL_INFO LogLevel = iota
	LEVEL_WARN
	LEVEL_ERROR
)

var levelStrings = map[LogLevel]string{
	LEVEL_INFO:  "INFO",
	LEVEL_WARN:  "WARN",
	LEVEL_ERROR: "ERROR",
}

type LogMessage struct {
	Level     LogLevel
	Timestamp time.Time
	Message   string
}

type AsyncLogger struct {
	logChan chan LogMessage
	done    chan struct{}
	wg      sync.WaitGroup
	file    *os.File
	mutex   sync.Mutex
}

func NewAsyncLogger(logDir string) (*AsyncLogger, error) {
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create log directory: %v", err)
	}
	logFile := filepath.Join(logDir, "wiki-explorer.log")

	file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %v", err)
	}

	logger := &AsyncLogger{
		logChan: make(chan LogMessage, 1000),
		done:    make(chan struct{}),
		file:    file,
	}

	logger.wg.Add(1)
	go logger.logWorker()

	return logger, nil
}

func (l *AsyncLogger) logWorker() {
	defer l.wg.Done()

	for {
		select {
		case msg := <-l.logChan:
			l.writeLog(msg)
		case <-l.done:
			for {
				select {
				case msg := <-l.logChan:
					l.writeLog(msg)
				default:
					return
				}
			}
		}
	}
}

func (l *AsyncLogger) writeLog(msg LogMessage) {
	l.mutex.Lock()
	defer l.mutex.Unlock()

	timestamp := msg.Timestamp.Format("2006-01-02 15:04")

	logLine := fmt.Sprintf("[%s] %s %s\n", levelStrings[msg.Level], timestamp, msg.Message)

	l.file.WriteString(logLine)
}

func (l *AsyncLogger) Info(msg string) {
	l.log(LEVEL_INFO, msg)
}

func (l *AsyncLogger) Warn(msg string) {
	l.log(LEVEL_WARN, msg)
}

func (l *AsyncLogger) Error(msg string) {
	l.log(LEVEL_ERROR, msg)
}

func (l *AsyncLogger) Infof(format string, args ...interface{}) {
	l.log(LEVEL_INFO, fmt.Sprintf(format, args...))
}

func (l *AsyncLogger) Warnf(format string, args ...interface{}) {
	l.log(LEVEL_WARN, fmt.Sprintf(format, args...))
}

func (l *AsyncLogger) Errorf(format string, args ...interface{}) {
	l.log(LEVEL_ERROR, fmt.Sprintf(format, args...))
}

func (l *AsyncLogger) log(level LogLevel, msg string) {
	select {
	case l.logChan <- LogMessage{
		Level:     level,
		Timestamp: time.Now(),
		Message:   msg,
	}:
	default:
	}
}

func (l *AsyncLogger) Stop() {
	close(l.done)
	l.wg.Wait()
	l.file.Close()
}
