#pragma once

#include <QDialog>

#include "../core/Settings.h"

class QComboBox;
class QLineEdit;
class QSpinBox;

class SettingsDialog : public QDialog {
    Q_OBJECT

public:
    explicit SettingsDialog(const QtocSettings &current, QWidget *parent = nullptr);

    QtocSettings settings() const;

private:
    QComboBox *m_provider = nullptr;
    QLineEdit *m_baseUrl = nullptr;
    QLineEdit *m_apiKey = nullptr;
    QLineEdit *m_model = nullptr;
    QSpinBox *m_port = nullptr;
};
