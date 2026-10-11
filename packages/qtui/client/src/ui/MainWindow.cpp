#include "MainWindow.h"

#include <QCloseEvent>
#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>
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
#include "../core/Settings.h"
#include "../core/SseClient.h"
#include "FormDialog.h"
#include "SettingsDialog.h"

MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent) {
    setWindowTitle("oc_core demo client");

    m_server = new ServerProcess(this);
    m_api = new ApiClient(this);
    m_sse = new SseClient(this);
    m_router = new EventRouter(this);
    m_model = new SessionModel(this);

    auto *toolbar = addToolBar("main");
    toolbar->addAction("Start server", this, &MainWindow::startServer);
    toolbar->addAction("Stop server", this, &MainWindow::stopServer);
    toolbar->addAction("Settings...", this, &MainWindow::onSettings);
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

    connect(m_router, &EventRouter::textStarted, this,
            [this](const QString &sessionID, const QString &messageID, int ordinal) {
                m_model->textStarted(sessionID, messageID, ordinal);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::textDelta, this,
            [this](const QString &sessionID, const QString &messageID, int ordinal, const QString &delta) {
                m_model->textDelta(sessionID, messageID, ordinal, delta);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::textEnded, this,
            [this](const QString &sessionID, const QString &messageID, int ordinal, const QString &text) {
                m_model->textEnded(sessionID, messageID, ordinal, text);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::reasoningStarted, this,
            [this](const QString &sessionID, const QString &messageID, int ordinal) {
                m_model->reasoningStarted(sessionID, messageID, ordinal);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::reasoningDelta, this,
            [this](const QString &sessionID, const QString &messageID, int ordinal, const QString &delta) {
                m_model->reasoningDelta(sessionID, messageID, ordinal, delta);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::reasoningEnded, this,
            [this](const QString &sessionID, const QString &messageID, int ordinal, const QString &text) {
                m_model->reasoningEnded(sessionID, messageID, ordinal, text);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::toolInputStarted, this,
            [this](const QString &sessionID, const QString &messageID, const QString &toolID, const QString &name) {
                m_model->toolInputStarted(sessionID, messageID, toolID, name);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::toolInputDelta, this,
            [this](const QString &sessionID, const QString &messageID, const QString &toolID, const QString &delta) {
                m_model->toolInputDelta(sessionID, messageID, toolID, delta);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::toolInputEnded, this,
            [this](const QString &sessionID, const QString &messageID, const QString &toolID, const QString &text) {
                m_model->toolInputEnded(sessionID, messageID, toolID, text);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::toolCalled, this,
            [this](const QString &sessionID, const QString &messageID, const QString &toolID,
                   const QJsonObject &input) {
                m_model->toolCalled(sessionID, messageID, toolID, input);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::toolProgress, this,
            [this](const QString &sessionID, const QString &messageID, const QString &toolID,
                   const QJsonObject &metadata) {
                m_model->toolProgress(sessionID, messageID, toolID, metadata);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::toolSucceeded, this,
            [this](const QString &sessionID, const QString &messageID, const QString &toolID, const QJsonArray &,
                   const QJsonObject &metadata) {
                m_model->toolSucceeded(sessionID, messageID, toolID, metadata);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::toolFailed, this,
            [this](const QString &sessionID, const QString &messageID, const QString &toolID,
                   const QString &message) {
                m_model->toolFailed(sessionID, messageID, toolID, message);
                m_renderTimer->start();
            });
    connect(m_router, &EventRouter::sessionIdle, this, &MainWindow::onSessionIdle);
    connect(m_router, &EventRouter::sessionStatus, this, &MainWindow::onSessionStatus);
    connect(m_router, &EventRouter::sessionRetry, this,
            [this](const QString &, int attempt, const QString &message) {
                appendLog(QString("retry %1: %2").arg(attempt).arg(message));
                setStatus(QString("retry %1").arg(attempt));
            });
    connect(m_router, &EventRouter::sessionError, this,
            [this](const QString &, const QString &message) { showSystem("error: " + message); });
    connect(m_router, &EventRouter::executionEnded, this,
            [this](const QString &sessionID, const QString &outcome) {
                if (!sessionID.isEmpty() && !m_sessionID.isEmpty() && sessionID != m_sessionID) return;
                appendLog("execution " + outcome);
                setStatus(outcome == "succeeded" ? QString("idle") : outcome);
                fetchMessages();
            });
    connect(m_router, &EventRouter::permissionAsked, this, &MainWindow::onPermissionAsked);
    connect(m_router, &EventRouter::permissionReplied, this,
            [this](const QString &requestID) { appendLog("permission replied: " + requestID); });
    connect(m_router, &EventRouter::formCreated, this, &MainWindow::onFormCreated);
    connect(m_router, &EventRouter::formReplied, this,
            [this](const QString &formID) { appendLog("form replied: " + formID); });
    connect(m_router, &EventRouter::formCancelled, this,
            [this](const QString &formID) { appendLog("form cancelled: " + formID); });
    connect(m_router, &EventRouter::unhandled, this, [this](const QString &type) {
        if (qEnvironmentVariableIsSet("OC_DEBUG")) appendLog("event: " + type);
    });

    const OcSettings initial = OcSettings::load();
    if (!initial.modelString().isEmpty()) setWindowTitle("oc_core demo client - " + initial.modelString());
    setStatus(QString("oc_core: %1").arg(corePath()));
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
    const QString fromEnv = qEnvironmentVariable("OC_CORE_PATH");
    if (!fromEnv.isEmpty()) return fromEnv;
#ifdef OC_CORE_DEFAULT
    const QString fallback = QStringLiteral(OC_CORE_DEFAULT);
    if (QFileInfo::exists(fallback)) return fallback;
#endif
    const QString name = QStringLiteral("oc_core%1").arg(
#ifdef Q_OS_WIN
        ".exe"
#else
        ""
#endif
    );
    return QDir(QCoreApplication::applicationDirPath()).filePath(name);
}

QString MainWindow::configJson() const {
    return OcSettings::load().configJson();
}

void MainWindow::onSettings() {
    SettingsDialog dialog(OcSettings::load(), this);
    if (dialog.exec() != QDialog::Accepted) return;

    const OcSettings settings = dialog.settings();
    settings.save();
    appendLog("settings saved: provider=" + settings.provider + " model=" + settings.modelString() +
              " port=" + QString::number(settings.port) +
              (settings.baseUrl.isEmpty() ? QString() : " baseUrl=" + settings.baseUrl));
    setWindowTitle(settings.modelString().isEmpty() ? "oc_core demo client"
                                                    : "oc_core demo client - " + settings.modelString());

    if (m_server->isRunning()) {
        const auto answer = QMessageBox::question(this, "Restart server",
                                                  "Settings saved. Restart the server now to apply them?");
        if (answer == QMessageBox::Yes) {
            stopServer();
            startServer();
        } else {
            showSystem("settings saved; restart the server to apply");
        }
    }
}

void MainWindow::startServer() {
    const OcSettings settings = OcSettings::load();
    ServerProcess::Options options;
    options.corePath = corePath();
    options.workDir = m_temp.filePath("workspace");
    options.stateDir = m_temp.filePath("state");
    options.password = QUuid::createUuid().toString(QUuid::WithoutBraces);
    options.configJson = settings.configJson();
    options.port = settings.port;
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
    const QString directory = m_temp.filePath("workspace");
    m_api->configure(m_server->baseUrl(), m_server->password(), directory);
    m_sse->open(QUrl(m_server->baseUrl().toString() + "/api/event"), m_api->authHeader(), directory);
    appendLog(QString("server ready on port %1").arg(port));
    setStatus("ready");

    m_api->fetchInfo([this](bool ok, const QJsonDocument &doc, const QString &error) {
        if (!ok) {
            appendLog("info check failed: " + error);
            return;
        }
        const QJsonObject info = doc.object();
        appendLog(QString("oc_core %1 (pid %2, urls %3)")
                      .arg(info.value("version").toString())
                      .arg(info.value("pid").toInt())
                      .arg(info.value("urls").toArray().size()));
    });

    checkProviders();
    createSession();
}

void MainWindow::onSseOpened() {
    appendLog("event stream connected");
}

void MainWindow::checkProviders() {
    m_api->fetchProviders([this](bool ok, const QJsonDocument &doc, const QString &error) {
        if (!ok) {
            appendLog("provider check failed: " + error);
            return;
        }
        QStringList providerIDs;
        for (const QJsonValue &value : doc.object().value("data").toArray()) {
            providerIDs.append(value.toObject().value("id").toString());
        }

        m_api->fetchModels([this, providerIDs](bool modelsOk, const QJsonDocument &modelsDoc,
                                               const QString &modelsError) {
            if (!modelsOk) {
                appendLog("model check failed: " + modelsError);
                return;
            }
            const QJsonArray models = modelsDoc.object().value("data").toArray();
            QStringList modelRefs;
            for (const QJsonValue &value : models) {
                const QJsonObject model = value.toObject();
                modelRefs.append(model.value("providerID").toString() + "/" + model.value("id").toString());
            }
            appendLog(QString("providers: %1 [%2], models: %3")
                          .arg(providerIDs.size())
                          .arg(providerIDs.join(", "))
                          .arg(models.size()));

            m_api->fetchModelDefault([this](bool defaultOk, const QJsonDocument &defaultDoc, const QString &) {
                if (!defaultOk) return;
                const QJsonObject model = defaultDoc.object().value("data").toObject();
                if (!model.isEmpty()) {
                    appendLog("default model: " + model.value("providerID").toString() + "/" +
                              model.value("id").toString());
                }
            });

            if (qEnvironmentVariableIsSet("OC_CONFIG_JSON")) {
                appendLog("config override in use (OC_CONFIG_JSON)");
                return;
            }
            const OcSettings settings = OcSettings::load();
            const QString model = settings.modelString();
            if (models.isEmpty()) {
                showSystem(
                    "no provider models available: set API Key in Settings... (or a provider env var such as "
                    "ANTHROPIC_API_KEY)");
                return;
            }
            if (model.isEmpty()) {
                showSystem("no model configured: open Settings... and set LLM type + model");
                return;
            }
            if (!modelRefs.contains(model)) {
                showSystem("model not in catalog: " + model + " (check LLM type + model name)");
                return;
            }
            appendLog("using model: " + model);
        });
    });

    m_api->fetchConfig([this](bool ok, const QJsonDocument &doc, const QString &error) {
        if (!ok) {
            appendLog("config check failed: " + error);
            return;
        }
        appendLog(QString("config documents: %1").arg(doc.array().size()));
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
    m_api->createSession("oc demo", [this](bool ok, const QJsonDocument &doc, const QString &error) {
        if (!ok) {
            appendLog("create session failed: " + error);
            return;
        }
        const QString sessionID = doc.object().value("data").toObject().value("id").toString();
        if (sessionID.isEmpty()) {
            showSystem("create session failed: response has no id");
            return;
        }
        m_sessionID = sessionID;
        m_model->setSession(sessionID);
        m_notice.clear();
        refreshTranscript();
        appendLog("session: " + sessionID);
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

    const QString sessionID = m_sessionID;
    m_api->sendPrompt(sessionID, text,
                      [this, sessionID, text](bool ok, const QJsonDocument &doc, const QString &error) {
                          if (!ok) {
                              showSystem("prompt failed: " + error);
                              return;
                          }
                          const QJsonObject item = doc.object().value("data").toObject();
                          const QString messageID = item.value("id").toString();
                          QString promptText = item.value("payload").toObject().value("text").toString();
                          if (promptText.isEmpty()) promptText = text;
                          m_model->addUserMessage(sessionID, messageID, promptText);
                          m_renderTimer->start();
                          appendLog("prompt accepted: " + promptText);
                      });
    setStatus("running");
}

void MainWindow::abortSession() {
    if (m_sessionID.isEmpty()) return;
    m_api->interruptSession(m_sessionID, [this](bool ok, const QJsonDocument &doc, const QString &error) {
        if (!ok) {
            appendLog("interrupt failed: " + error);
            return;
        }
        appendLog(doc.object().value("interrupted").toBool() ? "interrupt requested"
                                                             : "no active execution to interrupt");
    });
}

void MainWindow::onEvent(const QJsonObject &event) {
    if (qEnvironmentVariableIsSet("OC_DEBUG")) {
        appendLog("event: " + event.value("type").toString());
    }
    m_router->handle(event);
}

void MainWindow::onSessionIdle(const QString &sessionID) {
    if (!sessionID.isEmpty() && !m_sessionID.isEmpty() && sessionID != m_sessionID) return;
    setStatus("idle");
    fetchMessages();
}

void MainWindow::onSessionStatus(const QString &, const QString &status) {
    if (!status.isEmpty()) setStatus(status);
}

void MainWindow::fetchMessages() {
    if (m_sessionID.isEmpty()) return;
    const QString sessionID = m_sessionID;
    m_api->fetchMessages(sessionID, [this, sessionID](bool ok, const QJsonDocument &doc, const QString &error) {
        if (sessionID != m_sessionID) return;
        if (!ok) {
            appendLog("message fetch failed: " + error);
            return;
        }
        const QJsonArray data = doc.object().value("data").toArray();
        QJsonArray chronological;
        for (int index = data.size() - 1; index >= 0; --index) chronological.append(data.at(index));
        m_model->applyMessages(chronological);
        m_renderTimer->start();
    });
}

void MainWindow::onPermissionAsked(const QJsonObject &request) {
    const QString requestID = request.value("id").toString();
    const QString sessionID = request.value("sessionID").toString();
    const QString action = request.value("action").toString();
    QStringList resources;
    for (const QJsonValue &value : request.value("resources").toArray()) resources.append(value.toString());

    QMessageBox box(this);
    box.setWindowTitle("Permission required");
    box.setText(QString("Action: %1\nResources:\n%2").arg(action, resources.join("\n")));
    const QString message = request.value("message").toString();
    if (!message.isEmpty()) box.setInformativeText(message);
    QPushButton *once = box.addButton("Once", QMessageBox::AcceptRole);
    QPushButton *always = box.addButton("Always", QMessageBox::YesRole);
    box.addButton("Reject", QMessageBox::RejectRole);
    box.exec();

    QString decision = "reject";
    if (box.clickedButton() == once) decision = "once";
    if (box.clickedButton() == always) decision = "always";

    m_api->replyPermission(sessionID, requestID, decision,
                           [this, decision](bool ok, const QJsonDocument &, const QString &error) {
                               appendLog(ok ? QString("permission reply: %1").arg(decision)
                                            : QString("permission reply failed: %1").arg(error));
                           });
}

void MainWindow::onFormCreated(const QJsonObject &form) {
    const QString formID = form.value("id").toString();
    const QString sessionID = form.value("sessionID").toString();
    if (formID.isEmpty()) return;
    appendLog("form: " + form.value("title").toString());

    FormDialog dialog(form, this);
    if (dialog.exec() == QDialog::Accepted) {
        m_api->replyForm(sessionID, formID, dialog.answer(),
                         [this, formID](bool ok, const QJsonDocument &, const QString &error) {
                             appendLog(ok ? "form reply: " + formID : "form reply failed: " + error);
                         });
        return;
    }
    m_api->cancelForm(sessionID, formID, "dismissed by user",
                      [this, formID](bool ok, const QJsonDocument &, const QString &error) {
                          appendLog(ok ? "form cancelled: " + formID : "form cancel failed: " + error);
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
