#include <QEventLoop>
#include <QFileInfo>
#include <QJsonDocument>
#include <QSignalSpy>
#include <QTemporaryDir>
#include <QtTest>

#include "../src/core/ApiClient.h"
#include "../src/core/EventRouter.h"
#include "../src/core/ServerProcess.h"
#include "../src/core/SseClient.h"

// Real-model end-to-end for the V2 client transport stack: starts oc_core,
// subscribes to /api/event, creates a session, prompts, and waits for the
// terminal execution event with streamed assistant text.
// Opt-in via OC_TEST_E2E=1 (needs network to the built-in free Zen model, or
// point OC_TEST_MODEL at another provider/model).
class TstV2Session : public QObject {
    Q_OBJECT

private slots:
    void realModelSession();
};

void TstV2Session::realModelSession() {
    if (qEnvironmentVariable("OC_TEST_E2E") != "1") {
        QSKIP("set OC_TEST_E2E=1 to run the real-model end-to-end test");
    }
    QString corePath = qEnvironmentVariable("OC_CORE_PATH");
#ifdef OC_CORE_DEFAULT
    if (corePath.isEmpty()) corePath = QStringLiteral(OC_CORE_DEFAULT);
#endif
    if (corePath.isEmpty() || !QFileInfo::exists(corePath)) {
        QSKIP("oc_core not found; set OC_CORE_PATH or copy it to client/fixtures/");
    }
    const QString model = qEnvironmentVariable("OC_TEST_MODEL", "opencode/ling-3.1-flash-free");

    QTemporaryDir temp;
    QVERIFY(temp.isValid());

    ServerProcess server;
    ServerProcess::Options options;
    options.corePath = corePath;
    options.workDir = temp.filePath("workspace");
    options.stateDir = temp.filePath("state");
    options.password = "e2e-secret";
    options.configJson = QString("{\"model\":\"%1\"}").arg(model);

    QString error;
    QVERIFY2(server.start(options, &error), qPrintable(error));
    QSignalSpy readySpy(&server, &ServerProcess::ready);
    QVERIFY2(readySpy.wait(60000), "server did not become ready within 60s");

    ApiClient api;
    api.configure(server.baseUrl(), server.password(), temp.filePath("workspace"));
    EventRouter router;
    SseClient sse;
    connect(&sse, &SseClient::eventReceived, &router, &EventRouter::handle);

    bool infoOk = false;
    QString infoError;
    QJsonDocument infoDoc;
    api.fetchInfo([&](bool ok, const QJsonDocument &document, const QString &message) {
        infoOk = ok;
        infoDoc = document;
        infoError = message;
    });
    QTRY_VERIFY_WITH_TIMEOUT(infoOk, 30000);
    QVERIFY2(infoOk, qPrintable(infoError));
    QVERIFY(!infoDoc.object().value("version").toString().isEmpty());

    QSignalSpy openedSpy(&sse, &SseClient::opened);
    sse.open(QUrl(server.baseUrl().toString() + "/api/event"), api.authHeader(), temp.filePath("workspace"));
    QVERIFY2(openedSpy.wait(30000), "event stream did not open");

    bool createdOk = false;
    QString createdError;
    QJsonDocument createdDoc;
    api.createSession("v2 e2e", [&](bool ok, const QJsonDocument &document, const QString &message) {
        createdOk = ok;
        createdDoc = document;
        createdError = message;
    });
    QTRY_VERIFY_WITH_TIMEOUT(createdOk, 30000);
    QVERIFY2(createdOk, qPrintable(createdError));
    const QString sessionID = createdDoc.object().value("data").toObject().value("id").toString();
    QVERIFY(!sessionID.isEmpty());

    QString text;
    QString outcome;
    QString sessionError;
    connect(&router, &EventRouter::textDelta, this,
            [&text, sessionID](const QString &session, const QString &, int, const QString &delta) {
                if (session == sessionID) text += delta;
            });
    connect(&router, &EventRouter::executionEnded, this,
            [&outcome](const QString &session, const QString &result) {
                if (session.isEmpty() || outcome.isEmpty()) outcome = result;
            });
    connect(&router, &EventRouter::sessionError, this,
            [&sessionError](const QString &, const QString &message) { sessionError = message; });

    bool promptOk = false;
    QString promptError;
    api.sendPrompt(sessionID, "Reply with exactly: hello from oc_core",
                   [&](bool ok, const QJsonDocument &, const QString &message) {
                       promptOk = ok;
                       promptError = message;
                   });
    QTRY_VERIFY_WITH_TIMEOUT(promptOk, 30000);
    QVERIFY2(promptOk, qPrintable(promptError));

    QTRY_VERIFY_WITH_TIMEOUT(!outcome.isEmpty(), 240000);
    server.stop();

    QVERIFY2(outcome == "succeeded", qPrintable(outcome + " " + sessionError));
    QVERIFY2(text.contains("hello from oc_core"), qPrintable(text));
}

QTEST_MAIN(TstV2Session)
#include "tst_v2_session.moc"
