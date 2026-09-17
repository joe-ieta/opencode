#include "ServerProcess.h"

#include <QDir>
#include <QFileInfo>
#include <QProcessEnvironment>
#include <QRegularExpression>

ServerProcess::ServerProcess(QObject *parent) : QObject(parent) {
    m_process.setProcessChannelMode(QProcess::SeparateChannels);
    connect(&m_process, &QProcess::readyReadStandardOutput, this, &ServerProcess::handleStdout);
    connect(&m_process, &QProcess::readyReadStandardError, this, &ServerProcess::handleStderr);
    connect(&m_process, &QProcess::finished, this,
            [this](int exitCode, QProcess::ExitStatus) { handleFinished(exitCode); });
}

bool ServerProcess::start(const Options &options, QString *error) {
    if (m_process.state() != QProcess::NotRunning) {
        if (error) *error = "server is already running";
        return false;
    }
    if (!QFileInfo::exists(options.corePath)) {
        if (error) *error = QString("qtoc_core not found: %1").arg(options.corePath);
        return false;
    }

    m_options = options;
    m_port = 0;
    m_ready = false;
    m_stdoutBuffer.clear();

    QDir().mkpath(options.workDir);
    QDir().mkpath(options.stateDir + "/data");
    QDir().mkpath(options.stateDir + "/state");
    QDir().mkpath(options.stateDir + "/config");

    QProcessEnvironment env = QProcessEnvironment::systemEnvironment();
    env.insert("OPENCODE_SERVER_PASSWORD", options.password);
    env.insert("OPENCODE_CLIENT", "desktop");
    if (!options.configJson.isEmpty()) env.insert("OPENCODE_CONFIG_CONTENT", options.configJson);
    // Keep test state out of the user profile.
    env.insert("XDG_DATA_HOME", options.stateDir + "/data");
    env.insert("XDG_STATE_HOME", options.stateDir + "/state");
    env.insert("XDG_CONFIG_HOME", options.stateDir + "/config");

    m_process.setProcessEnvironment(env);
    m_process.setWorkingDirectory(options.workDir);
    m_process.setProgram(options.corePath);
    m_process.setArguments({"serve", "--hostname", "127.0.0.1", "--port", "0"});
    m_process.start();

    if (!m_process.waitForStarted(10000)) {
        if (error) *error = QString("failed to start qtoc_core: %1").arg(m_process.errorString());
        return false;
    }
    return true;
}

void ServerProcess::stop() {
    if (m_process.state() == QProcess::NotRunning) return;
    m_process.terminate();
    if (!m_process.waitForFinished(3000)) {
        m_process.kill();
        m_process.waitForFinished(2000);
    }
}

QUrl ServerProcess::baseUrl() const {
    return QUrl(QString("http://127.0.0.1:%1").arg(m_port));
}

void ServerProcess::handleStdout() {
    m_stdoutBuffer.append(m_process.readAllStandardOutput());
    int index = -1;
    while ((index = m_stdoutBuffer.indexOf('\n')) >= 0) {
        const QString line = QString::fromUtf8(m_stdoutBuffer.left(index)).trimmed();
        m_stdoutBuffer.remove(0, index + 1);
        if (line.isEmpty()) continue;
        emit logLine(line);

        if (m_ready) continue;
        static const QRegularExpression re(QStringLiteral("listening on http://[^:]+:(\\d+)"));
        const QRegularExpressionMatch match = re.match(line);
        if (!match.hasMatch()) continue;
        m_port = static_cast<quint16>(match.captured(1).toUInt());
        m_ready = true;
        emit ready(m_port);
    }
}

void ServerProcess::handleStderr() {
    const QString text = QString::fromUtf8(m_process.readAllStandardError()).trimmed();
    if (!text.isEmpty()) emit logLine(text);
}

void ServerProcess::handleFinished(int exitCode) {
    const bool wasReady = m_ready;
    m_ready = false;
    if (wasReady) emit stopped();
    else emit failed(QString("qtoc_core exited with code %1").arg(exitCode));
}
