#pragma once

#include <QObject>
#include <QProcess>
#include <QString>
#include <QUrl>

class ServerProcess : public QObject {
    Q_OBJECT

public:
    struct Options {
        QString corePath;
        QString workDir;
        QString stateDir;
        QString configJson;
        QString password;
        quint16 port = 0;  // 0 = random
    };

    explicit ServerProcess(QObject *parent = nullptr);
    ~ServerProcess() override;

    bool start(const Options &options, QString *error);
    void stop();
    bool isRunning() const { return m_process.state() != QProcess::NotRunning; }
    bool isReady() const { return m_ready; }
    quint16 port() const { return m_port; }
    QString password() const { return m_options.password; }
    QUrl baseUrl() const;

signals:
    void ready(quint16 port);
    void logLine(const QString &line);
    void failed(const QString &message);
    void stopped();

private:
    void handleStdout();
    void handleStderr();
    void handleFinished(int exitCode);

    QProcess m_process;
    Options m_options;
    QByteArray m_stdoutBuffer;
    quint16 m_port = 0;
    bool m_ready = false;
};
