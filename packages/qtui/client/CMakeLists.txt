cmake_minimum_required(VERSION 3.21)
project(qtoc-client VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Widgets Network Test)
qt_standard_project_setup()

if(NOT QTOC_CORE_PATH)
  if(DEFINED ENV{QTOC_CORE_PATH})
    set(QTOC_CORE_PATH "$ENV{QTOC_CORE_PATH}")
  elseif(WIN32)
    set(QTOC_CORE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/fixtures/qtoc_core.exe")
  else()
    set(QTOC_CORE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/fixtures/qtoc_core")
  endif()
endif()
get_filename_component(QTOC_CORE_NAME "${QTOC_CORE_PATH}" NAME)

qt_add_executable(qtoc-client
  src/main.cpp
  src/core/ServerProcess.cpp
  src/core/ServerProcess.h
  src/core/ApiClient.cpp
  src/core/ApiClient.h
  src/core/SseParser.cpp
  src/core/SseParser.h
  src/core/SseClient.cpp
  src/core/SseClient.h
  src/core/EventRouter.cpp
  src/core/EventRouter.h
  src/core/SessionModel.cpp
  src/core/SessionModel.h
  src/ui/MainWindow.cpp
  src/ui/MainWindow.h
)

target_link_libraries(qtoc-client PRIVATE Qt6::Widgets Qt6::Network)
target_compile_definitions(qtoc-client PRIVATE QTOC_CORE_DEFAULT="${QTOC_CORE_PATH}")

if(EXISTS "${QTOC_CORE_PATH}")
  add_custom_command(TARGET qtoc-client POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
      "${QTOC_CORE_PATH}"
      "$<TARGET_FILE_DIR:qtoc-client>/${QTOC_CORE_NAME}")
endif()

enable_testing()
add_subdirectory(tests)
