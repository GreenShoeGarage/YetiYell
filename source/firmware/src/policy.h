#pragma once
#include <stdint.h>
namespace Policy {
constexpr uint32_t heartbeatTimeout = 6000;
inline bool expired(uint32_t now, uint32_t started, uint32_t duration) { return uint32_t(now-started) >= duration; }
inline bool validDuration(int n) { return n >= 5 && n <= 120; }
inline bool validInterval(int n) { return n >= 100 && n <= 2000; }
inline bool validChannel(int n) { return n >= 1 && n <= 11; }
inline bool validPower(bool wifi,int n) { return wifi ? (n == 2 || n == 5 || n == 8) : (n == -12 || n == -6 || n == 0 || n == 3); }
}
