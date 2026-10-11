#pragma once

#include <QDialog>
#include <QJsonArray>
#include <QJsonObject>
#include <QList>
#include <QString>

class QCheckBox;
class QComboBox;
class QFormLayout;
class QLineEdit;
class QWidget;

// Renders a V2 `Form.Info` (form.created / Form.Fields schema) and produces a
// `Form.Answer` object. Visibility follows the `when` conditions; inactive
// fields are neither required nor answerable.
class FormDialog : public QDialog {
    Q_OBJECT

public:
    explicit FormDialog(const QJsonObject &form, QWidget *parent = nullptr);

    QJsonObject answer() const;

public slots:
    void accept() override;

private:
    struct Field {
        QString key;
        QString title;
        QString type;
        bool custom = false;
        bool required = false;
        QJsonArray when;
        QWidget *editor = nullptr;
        QComboBox *combo = nullptr;
        QLineEdit *lineEdit = nullptr;
        QCheckBox *checkBox = nullptr;
        QList<QCheckBox *> optionChecks;
        QList<QString> optionValues;
        QLineEdit *customEdit = nullptr;
    };

    void buildField(const QJsonObject &spec);
    void updateVisibility();
    bool fieldActive(const Field &field) const;
    bool whenHolds(const QJsonObject &condition) const;
    QJsonValue fieldValue(const Field &field) const;
    QJsonValue answerValue(const QString &key) const;

    QFormLayout *m_layout = nullptr;
    QList<Field> m_fields;
    QJsonObject m_hiddenDefaults;
};
