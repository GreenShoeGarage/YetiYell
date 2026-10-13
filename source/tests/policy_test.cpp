#include "../firmware/src/policy.h"
#include <cassert>
#include <iostream>
int main(){
 using namespace Policy;
 assert(validDuration(5)&&validDuration(120)&&!validDuration(121)&&!validDuration(-1));
 assert(validPower(false,-12)&&!validPower(false,8)&&validPower(true,8)&&!validPower(true,-12));
 assert(validChannel(1)&&validChannel(11)&&!validChannel(12));assert(validInterval(100)&&!validInterval(99));
 assert(!expired(5999,0,heartbeatTimeout));assert(expired(6000,0,heartbeatTimeout));
 assert(expired(5990,0xFFFFFFF0,heartbeatTimeout));assert(!expired(5000,0xFFFFFFF0,heartbeatTimeout));
 std::cout<<"Firmware policy: duration, RF settings, heartbeat, timer rollover passed\n";
}
