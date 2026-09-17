#pragma once

#include <QMainWindow>
#include <QTemporaryDir>

class QLabel;
class QLineEdit;
class QPlainTextEdit;
class QPushButton;
class QTimer;
class ApiClient;
class EventRouter;
class ServerProcess;
class SessionModel;
class SseClient;

class MainWindow : public QMainWindow {
    Q_OBJECT

public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow() override;

protected:
    void closeEvent(QCloseEvent *event) override;

private slots:
    void startServer();
    void stopServer();
    void createSession();
    void sendPrompt();
    void abortSession();
    void onServerReady(quint16 port);
    void onServerLog(const QString &line);
    void onServerFailed(const QString &message);
    void onSseOpened();
    void onEvent(const QJsonObject &event);
    void onPartUpdated(const QJsonObject &part);
    void onPartDelta(const QString &partID, const QString &field, const QString &delta);
    void onSessionStatus(const QString &sessionID, const QString &status);
    void onPermissionAsked(const QJsonObject &request);
    void onQuestionAsked(const QJsonObject &request);
    void refreshTranscript();

private:
    QString corePath() const;
    QString configJson() const;
    void checkProviders();
    void appendLog(const QString &line);
    void showSystem(const QString &line);
    void setStatus(const QString &text);

    ServerProcess *m_server = nullptr;
    ApiClient *m_api = nullptr;
    SseClient *m_sse = nullptr;
    EventRouter *m_router = nullptr;
    SessionModel *m_model = nullptr;
    QTemporaryDir m_temp;
    QString m_sessionID;
    QString m_notice;
    QPlainTextEdit *m_transcript = nullptr;
    QPlainTextEdit *m_log = nullptr;
    QLineEdit *m_input = nullptr;
    QPushButton *m_send = nullptr;
    QPushButton *m_abort = nullptr;
    QPushButton *m_newSession = nullptr;
    QLabel *m_status = nullptr;
    QTimer *m_renderTimer = nullptr;
};
