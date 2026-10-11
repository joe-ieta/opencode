#include <QApplication>

#include "ui/MainWindow.h"

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    QApplication::setApplicationName("oc-client");
    QApplication::setOrganizationName("oc");

    MainWindow window;
    window.resize(960, 640);
    window.show();

    return app.exec();
}
