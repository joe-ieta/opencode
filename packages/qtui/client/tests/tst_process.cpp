#include <QEventLoop>
#include <QFileInfo>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QSignalSpy>
#include <QTemporaryDir>
#include <QtTest>

#include "../src/core/ServerProcess.h"

class TstProcess : public QObject {
    Q_OBJECT

private slots:
    void healthCheck();
};

void TstProcess::healthCheck() {
    QString corePath = qEnvironmentVariable("OC_CORE_PATH");
#ifdef OC_CORE_DEFAULT
    if (corePath.isEmpty()) corePath = QStringLiteral(OC_CORE_DEFAULT);
#endif
    if (corePath.isEmpty() || !QFileInfo::exists(corePath)) {
        QSKIP("oc_core not found; set OC_CORE_PATH or copy it to client/fixtures/");
    }

    QTemporaryDir temp;
    QVERIFY(temp.isValid());

    ServerProcess server;
    ServerProcess::Options options;
    options.corePath = corePath;
    options.workDir = temp.filePath("workspace");
    options.stateDir = temp.filePath("state");
    options.password = "test-secret";

    QString error;
    QVERIFY2(server.start(options, &error), qPrintable(error));

    QSignalSpy readySpy(&server, &ServerProcess::ready);
    QVERIFY2(readySpy.wait(60000), "server did not become ready within 60s");

    QNetworkAccessManager network;
    QNetworkRequest request(QUrl(server.baseUrl().toString() + "/api/info"));
    request.setRawHeader("Authorization", "Basic " + QByteArray("opencode:test-secret").toBase64());

    QNetworkReply *reply = network.get(request);
    QEventLoop loop;
    connect(reply, &QNetworkReply::finished, &loop, &QEventLoop::quit);
    loop.exec();

    QCOMPARE(reply->error(), QNetworkReply::NoError);
    const QJsonObject info = QJsonDocument::fromJson(reply->readAll()).object();
    reply->deleteLater();

    QVERIFY(!info.value("version").toString().isEmpty());
    QVERIFY(info.value("pid").toInt() > 0);
    QVERIFY(!info.value("urls").toArray().isEmpty());

    server.stop();
    QVERIFY(!server.isRunning());
}

QTEST_MAIN(TstProcess)
#include "tst_process.moc"
