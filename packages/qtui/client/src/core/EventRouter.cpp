#include "EventRouter.h"

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
    } else if (type == "session.error") {
        const QJsonObject error = properties.value("error").toObject();
        emit sessionError(properties.value("sessionID").toString(), error.value("message").toString());
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
