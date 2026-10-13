export const BOARDS={
 esp32dev:{chip:'ESP32',label:'ESP32 DevKit / WROOM-32 · 4 MB',directory:'./firmware/',boot:4096,flashSize:'4MB',flashFreq:'40m'},
 esp32c3:{chip:'ESP32-C3',label:'ESP32-C3 DevKitM-1 · 4 MB · UART',directory:'./firmware/esp32c3/',boot:0,flashSize:'4MB',flashFreq:'40m'},
 esp32s3:{chip:'ESP32-S3',label:'ESP32-S3 DevKitC-1 N8 · 8 MB · UART',directory:'./firmware/esp32s3/',boot:0,flashSize:'8MB',flashFreq:'80m'}
};
export function normalizeChip(chip){return String(chip).toUpperCase().replace(/^ESP32([CS][0-9])$/,'ESP32-$1');}
export function validateHello(hello){
 const chip=normalizeChip(hello.chip);
 if(hello.app!=='YetiYell'||hello.protocol!==1||!Object.values(BOARDS).some(b=>b.chip===chip)||!Array.isArray(hello.profiles)||hello.profiles.length>128||hello.profiles.some(x=>typeof x!=='string'))throw Error('This board is not running compatible YetiYell firmware. Flash it from Set up.');
 if(hello.maxDuration!==120||hello.heartbeatTimeoutMs!==6000)throw Error('Firmware safety limits do not match this app. Install the bundled release.');
 return {...hello,chip};
}
export function friendlyError(error){
 if(error.name==='NotFoundError')return 'No USB device selected. Choose the board and try again.';
 if(error.name==='SecurityError')return 'USB access was blocked. Open YetiYell in its own Chrome or Edge tab over HTTPS or localhost.';
 if(/open|locked|busy|claim/i.test(error.message))return error.message+' Close other serial monitors and YetiYell tabs, check the USB data cable, then reconnect.';
 if(/connect|sync|packet|timeout|reply/i.test(error.message))return error.message+' For flashing, hold BOOT while connecting and release it after chip detection. For operation, tap EN/RESET and reconnect.';
 return error.message;
}
