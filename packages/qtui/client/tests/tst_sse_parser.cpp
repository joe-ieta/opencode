#include <QtTest>

#include "../src/core/SseParser.h"

class TstSseParser : public QObject {
    Q_OBJECT

private slots:
    void simpleEvent();
    void splitAcrossChunks();
    void crlfAndHeartbeat();
    void multipleEvents();
    void invalidJsonIgnored();
};

void TstSseParser::simpleEvent() {
    SseParser parser;
    const QList<QJsonObject> events =
        parser.feed("data: {\"type\":\"session.idle\",\"properties\":{\"sessionID\":\"s1\"}}\n\n");
    QCOMPARE(events.size(), 1);
    QCOMPARE(events[0].value("type").toString(), QString("session.idle"));
    QCOMPARE(events[0].value("properties").toObject().value("sessionID").toString(), QString("s1"));
}

void TstSseParser::splitAcrossChunks() {
    SseParser parser;
    QCOMPARE(parser.feed("data: {\"type\":\"a\"").size(), 0);
    QCOMPARE(parser.feed(",\"properties\":{}}").size(), 0);
    const QList<QJsonObject> events = parser.feed("\n\n");
    QCOMPARE(events.size(), 1);
    QCOMPARE(events[0].value("type").toString(), QString("a"));
}

void TstSseParser::crlfAndHeartbeat() {
    SseParser parser;
    QCOMPARE(parser.feed(": heartbeat\r\n\r\n").size(), 0);
    const QList<QJsonObject> events = parser.feed("data: {\"type\":\"b\"}\r\n\r\n");
    QCOMPARE(events.size(), 1);
    QCOMPARE(events[0].value("type").toString(), QString("b"));
}

void TstSseParser::multipleEvents() {
    SseParser parser;
    const QList<QJsonObject> events = parser.feed("data: {\"type\":\"one\"}\n\ndata: {\"type\":\"two\"}\n\n");
    QCOMPARE(events.size(), 2);
    QCOMPARE(events[0].value("type").toString(), QString("one"));
    QCOMPARE(events[1].value("type").toString(), QString("two"));
}

void TstSseParser::invalidJsonIgnored() {
    SseParser parser;
    QCOMPARE(parser.feed("data: not-json\n\n").size(), 0);
    const QList<QJsonObject> events = parser.feed("data: {\"type\":\"ok\"}\n\n");
    QCOMPARE(events.size(), 1);
}

QTEST_MAIN(TstSseParser)
#include "tst_sse_parser.moc"
