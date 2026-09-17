add_executable(tst_sse_parser
  tst_sse_parser.cpp
  ../src/core/SseParser.cpp
  ../src/core/SseParser.h
)
target_link_libraries(tst_sse_parser PRIVATE Qt6::Test Qt6::Core)
add_test(NAME sse_parser COMMAND tst_sse_parser)

add_executable(tst_process
  tst_process.cpp
  ../src/core/ServerProcess.cpp
  ../src/core/ServerProcess.h
)
target_link_libraries(tst_process PRIVATE Qt6::Test Qt6::Core Qt6::Network)
target_compile_definitions(tst_process PRIVATE QTOC_CORE_DEFAULT="${QTOC_CORE_PATH}")
add_test(NAME process COMMAND tst_process)
