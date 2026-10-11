#include "EventRouter.h"

#include <QJsonDocument>
#include <QJsonValue>

namespace {
// Errors arrive as NamedError shapes ({ name, data: { message } }) or plain
// objects; fall back to the raw JSON so the UI never shows an empty message.
QString errorText(const QJsonValue &value) {
    if (value.isString()) return value.toString();
    const QJsonObject object = value.toObject();
    if (object.isEmpty()) return QString();
    const QJsonObject data = object.value("data").toObject();
    const QString message = data.value("message").toString();
    if (!message.isEmpty()) {
        const QString name = object.value("name").toString();
        return name.isEmpty() ? message : QString("%1: %2").arg(name, message);
    }
    const QString direct = object.value("message").toString();
    if (!direct.isEmpty()) return direct;
    return QString::fromUtf8(QJsonDocument(object).toJson(QJsonDocument::Compact));
}
}

EventRouter::EventRouter(QObject *parent) : QObject(parent) {}

void EventRouter::handle(const QJsonObject &event) {
    const QString type = event.value("type").toString();
    const QJsonObject properties = event.value("properties").toObject();

    if (type == "message.part.updated") {
        emit partUpdated(properties.value("part").toObject());
    } else if (type == "message.part.delta") {
        emit partDelta(properties.value("partID").toString(), properties.value("field").toString(),
                       properties.value("delta").toString());
    } else if (type == "session.idle") {
        emit sessionIdle(properties.value("sessionID").toString());
    } else if (type == "session.status") {
        const QJsonObject status = properties.value("status").toObject();
        emit sessionStatus(properties.value("sessionID").toString(), status.value("type").toString());
    } else if (type == "session.error") {
        emit sessionError(properties.value("sessionID").toString(), errorText(properties.value("error")));
    } else if (type == "permission.asked") {
        emit permissionAsked(properties);
    } else if (type == "permission.replied") {
        emit permissionReplied(properties.value("requestID").toString());
    } else if (type == "question.asked") {
        emit questionAsked(properties);
    } else if (type == "question.replied") {
        emit questionReplied(properties.value("requestID").toString());
    } else {
        emit unhandled(type);
    }
}
