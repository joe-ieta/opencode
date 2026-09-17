#include "MainWindow.h"

#include <QCloseEvent>
#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>
#include <QInputDialog>
#include <QJsonArray>
#include <QJsonDocument>
#include <QLabel>
#include <QLineEdit>
#include <QMessageBox>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QStatusBar>
#include <QTabWidget>
#include <QTextCursor>
#include <QTimer>
#include <QToolBar>
#include <QUuid>
#include <QVBoxLayout>
#include <QWidget>

#include "../core/ApiClient.h"
#include "../core/EventRouter.h"
#include "../core/ServerProcess.h"
#include "../core/SessionModel.h"
#include "../core/SseClient.h"

MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent) {
    setWindowTitle("qtoc_core demo client");

    m_server = new ServerProcess(this);
    m_api = new ApiClient(this);
    m_sse = new SseClient(this);
    m_router = new EventRouter(this);
    m_model = new SessionModel(this);

    auto *toolbar = addToolBar("main");
    toolbar->addAction("Start server", this, &MainWindow::startServer);
    toolbar->addAction("Stop server", this, &MainWindow::stopServer);
    toolbar->addSeparator();
    m_newSession = new QPushButton("New session", this);
    m_abort = new QPushButton("Abort", this);
    toolbar->addWidget(m_newSession);
    toolbar->addWidget(m_abort);

    m_transcript = new QPlainTextEdit(this);
    m_transcript->setReadOnly(true);
    m_log = new QPlainTextEdit(this);
    m_log->setReadOnly(true);
    m_log->setMaximumBlockCount(5000);

    auto *tabs = new QTabWidget(this);
    tabs->addTab(m_transcript, "Chat");
    tabs->addTab(m_log, "Server log");

    m_input = new QLineEdit(this);
    m_input->setPlaceholderText("Type a prompt and press Send");
    m_send = new QPushButton("Send", this);

    auto *inputRow = new QWidget(this);
    auto *inputLayout = new QVBoxLayout(inputRow);
    inputLayout->setContentsMargins(0, 0, 0, 0);
    inputLayout->addWidget(m_input);
    inputLayout->addWidget(m_send);

    auto *central = new QWidget(this);
    auto *layout = new QVBoxLayout(central);
    layout->addWidget(tabs, 1);
    layout->addWidget(inputRow);

    setCentralWidget(central);

    m_status = new QLabel("idle", this);
    statusBar()->addWidget(m_status);

    m_renderTimer = new QTimer(this);
    m_renderTimer->setSingleShot(true);
    m_renderTimer->setInterval(50);

    connect(m_renderTimer, &QTimer::timeout, this, &MainWindow::refreshTranscript);
    connect(m_newSession, &QPushButton::clicked, this, &MainWindow::createSession);
    connect(m_abort, &QPushButton::clicked, this, &MainWindow::abortSession);
    connect(m_send, &QPushButton::clicked, this, &MainWindow::sendPrompt);
    connect(m_input, &QLineEdit::returnPressed, this, &MainWindow::sendPrompt);

    connect(m_server, &ServerProcess::ready, this, &MainWindow::onServerReady);
    connect(m_server, &ServerProcess::logLine, this, &MainWindow::onServerLog);
    connect(m_server, &ServerProcess::failed, this, &MainWindow::onServerFailed);
    connect(m_server, &ServerProcess::stopped, this, [this]() { setStatus("stopped"); });

    connect(m_sse, &SseClient::opened, this, &MainWindow::onSseOpened);
    connect(m_sse, &SseClient::eventReceived, this, &MainWindow::onEvent);
    connect(m_sse, &SseClient::failed, this, &MainWindow::onServerFailed);

    connect(m_router, &EventRouter::partUpdated, this, &MainWindow::onPartUpdated);
    connect(m_router, &EventRouter::partDelta, this, &MainWindow::onPartDelta);
    connect(m_router, &EventRouter::sessionIdle, this, [this](const QString &) { setStatus("idle"); });
    connect(m_router, &EventRouter::sessionStatus, this, &MainWindow::onSessionStatus);
    connect(m_router, &EventRouter::sessionError, this, [this](const QString &, const QString &message) {
        showSystem("error: " + message);
    });
    connect(m_router, &EventRouter::unhandled, this, [this](const QString &type) {
        if (qEnvironmentVariableIsSet("QTOC_DEBUG")) appendLog("event: " + type);
    });
    connect(m_router, &EventRouter::permissionAsked, this, &MainWindow::onPermissionAsked);
    connect(m_router, &EventRouter::questionAsked, this, &MainWindow::onQuestionAsked);

    setStatus(QString("qtoc_core: %1").arg(corePath()));
}

MainWindow::~MainWindow() {
    m_sse->close();
    m_server->stop();
}

void MainWindow::closeEvent(QCloseEvent *event) {
    m_sse->close();
    m_server->stop();
    event->accept();
}

QString MainWindow::corePath() const {
    const QString fromEnv = qEnvironmentVariable("QTOC_CORE_PATH");
    if (!fromEnv.isEmpty()) return fromEnv;
#ifdef QTOC_CORE_DEFAULT
    const QString fallback = QStringLiteral(QTOC_CORE_DEFAULT);
    if (QFileInfo::exists(fallback)) return fallback;
#endif
    const QString name = QStringLiteral("qtoc_core%1").arg(
#ifdef Q_OS_WIN
        ".exe"
#else
        ""
#endif
    );
    return QDir(QCoreApplication::applicationDirPath()).filePath(name);
}

QString MainWindow::configJson() const {
    const QString override = qEnvironmentVariable("QTOC_CONFIG_JSON");
    if (!override.isEmpty()) return override;

    QJsonObject config{
        {"permission", QJsonObject{{"edit", "ask"}, {"bash", "ask"}}},
    };
    const QString model = qEnvironmentVariable("QTOC_MODEL");
    if (!model.isEmpty()) config.insert("model", model);
    return QString::fromUtf8(QJsonDocument(config).toJson(QJsonDocument::Compact));
}

void MainWindow::startServer() {
    ServerProcess::Options options;
    options.corePath = corePath();
    options.workDir = m_temp.filePath("workspace");
    options.stateDir = m_temp.filePath("state");
    options.password = QUuid::createUuid().toString(QUuid::WithoutBraces);
    options.configJson = configJson();
    appendLog("config: " + options.configJson);

    QString error;
    if (!m_server->start(options, &error)) {
        onServerFailed(error);
        return;
    }
    appendLog(QString("starting %1").arg(options.corePath));
    setStatus("starting...");
}

void MainWindow::stopServer() {
    m_sse->close();
    m_server->stop();
    setStatus("stopped");
}

void MainWindow::onServerReady(quint16 port) {
    m_api->configure(m_server->baseUrl(), m_server->password(), m_temp.filePath("workspace"));
    m_sse->open(QUrl(m_server->baseUrl().toString() + "/event"), m_api->authHeader());
    appendLog(QString("server ready on port %1").arg(port));
    setStatus("ready");
    checkProviders();
    createSession();
}

void MainWindow::onSseOpened() {
    appendLog("event stream connected");
}

void MainWindow::checkProviders() {
    m_api->get("/config/providers", [this](bool ok, const QJsonDocument &doc, const QString &error) {
        if (!ok) {
            appendLog("provider check failed: " + error);
            return;
        }
        const QJsonObject root = doc.object();
        const QJsonArray providers = root.value("providers").toArray();
        int models = 0;
        QStringList ids;
        for (const QJsonValue &value : providers) {
            const QJsonObject provider = value.toObject();
            ids.append(provider.value("id").toString());
            models += provider.value("models").toObject().size();
        }
        const QJsonObject defaults = root.value("default").toObject();
        appendLog(QString("providers: %1 [%2], models: %3, defaults: %4")
                      .arg(providers.size())
                      .arg(ids.join(", "))
                      .arg(models)
                      .arg(QString::fromUtf8(QJsonDocument(defaults).toJson(QJsonDocument::Compact))));
        if (models == 0) {
            showSystem("no provider models available: set credentials (e.g. ANTHROPIC_API_KEY or QTOC_AUTH_JSON) and QTOC_MODEL");
        } else if (qEnvironmentVariable("QTOC_MODEL").isEmpty() && !qEnvironmentVariableIsSet("QTOC_CONFIG_JSON")) {
            showSystem("no model configured: set QTOC_MODEL=provider/model to start chatting");
        }
    });
}

void MainWindow::onServerLog(const QString &line) {
    appendLog(line);
}

void MainWindow::onServerFailed(const QString &message) {
    appendLog("ERROR: " + message);
    setStatus("error");
}

void MainWindow::createSession() {
    if (!m_server->isReady()) return;
    m_api->post("/session", QJsonObject{{"title", "qtoc demo"}}, [this](bool ok, const QJsonDocument &doc, const QString &error) {
        if (!ok) {
            appendLog("create session failed: " + error);
            return;
        }
        m_sessionID = doc.object().value("id").toString();
        if (m_sessionID.isEmpty()) {
            showSystem("create session failed: response has no id");
            return;
        }
        m_model->reset();
        m_notice.clear();
        refreshTranscript();
        appendLog("session: " + m_sessionID);
        setStatus("session ready");
    });
}

void MainWindow::sendPrompt() {
    const QString text = m_input->text().trimmed();
    if (text.isEmpty()) return;
    if (m_sessionID.isEmpty()) {
        showSystem("no session ready; wait for the server and try again");
        return;
    }
    m_input->clear();

    const QJsonObject body{
        {"parts", QJsonArray{QJsonObject{{"type", "text"}, {"text", text}}}},
    };
    m_api->post(QString("/session/%1/prompt_async").arg(m_sessionID), body,
                [this, text](bool ok, const QJsonDocument &, const QString &error) {
                    if (ok) {
                        appendLog("prompt accepted: " + text);
                        return;
                    }
                    showSystem("prompt failed: " + error);
                });
    setStatus("running");
}

void MainWindow::abortSession() {
    if (m_sessionID.isEmpty()) return;
    m_api->post(QString("/session/%1/abort").arg(m_sessionID), {}, [](bool, const QJsonDocument &, const QString &) {});
}

void MainWindow::onEvent(const QJsonObject &event) {
    if (qEnvironmentVariableIsSet("QTOC_DEBUG")) {
        appendLog("event: " + event.value("type").toString());
    }
    m_router->handle(event);
}

void MainWindow::onSessionStatus(const QString &, const QString &status) {
    if (!status.isEmpty()) setStatus(status);
}

void MainWindow::onPartUpdated(const QJsonObject &part) {
    m_model->upsert(part);
    m_renderTimer->start();
}

void MainWindow::onPartDelta(const QString &partID, const QString &field, const QString &delta) {
    m_model->appendDelta(partID, field, delta);
    m_renderTimer->start();
}

void MainWindow::onPermissionAsked(const QJsonObject &request) {
    const QString requestID = request.value("id").toString();
    const QString permission = request.value("permission").toString();
    QJsonArray patterns = request.value("patterns").toArray();
    QStringList patternList;
    for (const QJsonValue &value : patterns) patternList.append(value.toString());

    QMessageBox box(this);
    box.setWindowTitle("Permission required");
    box.setText(QString("Tool: %1\nTargets:\n%2").arg(permission, patternList.join("\n")));
    QPushButton *once = box.addButton("Once", QMessageBox::AcceptRole);
    QPushButton *always = box.addButton("Always", QMessageBox::YesRole);
    box.addButton("Reject", QMessageBox::RejectRole);
    box.exec();

    QString reply = "reject";
    if (box.clickedButton() == once) reply = "once";
    if (box.clickedButton() == always) reply = "always";

    m_api->post(QString("/permission/%1/reply").arg(requestID), QJsonObject{{"reply", reply}},
                [this, reply](bool ok, const QJsonDocument &, const QString &error) {
                    appendLog(ok ? QString("permission reply: %1").arg(reply)
                                 : QString("permission reply failed: %1").arg(error));
                });
}

void MainWindow::onQuestionAsked(const QJsonObject &request) {
    const QString requestID = request.value("id").toString();
    const QJsonArray questions = request.value("questions").toArray();
    QJsonArray answers;

    for (const QJsonValue &value : questions) {
        const QJsonObject question = value.toObject();
        QJsonArray options = question.value("options").toArray();
        QStringList labels;
        for (const QJsonValue &option : options) labels.append(option.toObject().value("label").toString());

        QString answer;
        if (!labels.isEmpty()) {
            bool accepted = false;
            answer = QInputDialog::getItem(this, "Question", question.value("question").toString(), labels, 0, false,
                                           &accepted);
            if (!accepted) {
                m_api->post(QString("/question/%1/reject").arg(requestID), {},
                            [](bool, const QJsonDocument &, const QString &) {});
                return;
            }
        } else {
            bool accepted = false;
            answer = QInputDialog::getText(this, "Question", question.value("question").toString(), QLineEdit::Normal,
                                           QString(), &accepted);
            if (!accepted) {
                m_api->post(QString("/question/%1/reject").arg(requestID), {},
                            [](bool, const QJsonDocument &, const QString &) {});
                return;
            }
        }
        answers.append(QJsonArray{answer});
    }

    m_api->post(QString("/question/%1/reply").arg(requestID), QJsonObject{{"answers", answers}},
                [this](bool ok, const QJsonDocument &, const QString &error) {
                    if (!ok) appendLog("question reply failed: " + error);
                });
}

void MainWindow::refreshTranscript() {
    const QString body = m_model->transcript();
    m_transcript->setPlainText(m_notice.isEmpty() ? body : (body.isEmpty() ? m_notice : body + "\n\n" + m_notice));
    m_transcript->moveCursor(QTextCursor::End);
}

void MainWindow::appendLog(const QString &line) {
    m_log->appendPlainText(line);
}

void MainWindow::showSystem(const QString &line) {
    appendLog(line);
    if (!m_notice.isEmpty()) m_notice += "\n";
    m_notice += line;
    m_renderTimer->start();
}

void MainWindow::setStatus(const QString &text) {
    m_status->setText(text);
}
