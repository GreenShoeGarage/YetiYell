export { ESPLoader, Transport } from 'esptool-js';
import CryptoJS from 'crypto-js';
export function md5(bytes){return CryptoJS.MD5(CryptoJS.lib.WordArray.create(bytes)).toString();}
