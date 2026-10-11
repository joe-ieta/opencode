cmake_minimum_required(VERSION 3.21)
project(oc-client VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Widgets Network Test)
qt_standard_project_setup()

if(NOT OC_CORE_PATH)
  if(DEFINED ENV{OC_CORE_PATH})
    set(OC_CORE_PATH "$ENV{OC_CORE_PATH}")
  elseif(WIN32)
    set(OC_CORE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/fixtures/oc_core.exe")
  else()
    set(OC_CORE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/fixtures/oc_core")
  endif()
endif()
get_filename_component(OC_CORE_NAME "${OC_CORE_PATH}" NAME)

qt_add_executable(oc-client
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
  src/core/Settings.cpp
  src/core/Settings.h
  src/ui/MainWindow.cpp
  src/ui/MainWindow.h
  src/ui/SettingsDialog.cpp
  src/ui/SettingsDialog.h
)

target_link_libraries(oc-client PRIVATE Qt6::Widgets Qt6::Network)
target_compile_definitions(oc-client PRIVATE OC_CORE_DEFAULT="${OC_CORE_PATH}")

if(EXISTS "${OC_CORE_PATH}")
  add_custom_command(TARGET oc-client POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
      "${OC_CORE_PATH}"
      "$<TARGET_FILE_DIR:oc-client>/${OC_CORE_NAME}")
endif()

enable_testing()
add_subdirectory(tests)
