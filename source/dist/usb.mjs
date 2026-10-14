// Keep requestPort synchronous with the click; do not await a probe first.
export function usbEnvironment({nav=globalThis.navigator,doc=globalThis.document,win=globalThis.window,secure=globalThis.isSecureContext,location=win?.location}={}){
 let embedded=false;try{embedded=!!win&&win.top!==win.self;}catch{embedded=true;}
 let policy='unknown';try{const p=doc?.permissionsPolicy||doc?.featurePolicy;if(p?.allowsFeature)policy=p.allowsFeature('serial')?'allowed':'blocked';}catch{}
 const protocol=location?.protocol||'',api=typeof nav?.serial?.requestPort==='function';
 let code='ready',title='USB port picker available',detail='Click Connect ESP32, then select the USB serial port in your browser’s chooser.';
 if(protocol==='file:'){code='file';title='Serve the app before connecting';detail='This is a local HTML file. Serve the complete server folder at http://localhost, or upload it to an HTTPS website.';}
 else if(!secure){code='insecure';title='USB needs HTTPS or localhost';detail='Open this app using HTTPS or http://localhost. An ordinary HTTP address, including a local-network IP address, cannot request a USB serial port.';}
 else if(policy==='blocked'){code='policy';title=embedded?'Open YetiYell in its own browser tab':'This host blocks USB serial access';detail=embedded?'The embedding page has not allowed serial access. Open the app directly in desktop Chrome or Edge, then click Connect ESP32 again.':'The site’s Permissions-Policy blocks serial access. The host administrator must allow serial for this app. JavaScript cannot override that policy.';}
 else if(!api){code='unsupported';title='Web Serial is unavailable in this browser';detail='Open this URL directly in desktop Chrome or Edge. An embedded viewer or a browser without Web Serial cannot show the ESP32 port chooser.';}
 else if(embedded)detail='USB is exposed, but this embedded viewer may restrict the chooser. If it does not open, use Open app in browser tab and click Connect ESP32 there.';
 return {ok:code==='ready',code,title,detail,embedded,secure:!!secure,api,policy,protocol};
}
export function requestUSBPort(environment){
 const status=usbEnvironment(environment);
 if(!status.ok){const e=Error(status.detail);e.name='USBEnvironmentError';e.status=status;throw e;}
 return (environment?.nav||globalThis.navigator).serial.requestPort();
}
export function usbFailure(error,environment){
 const status=usbEnvironment(environment);
 if(!status.ok)return {...status,detail:status.detail};
 if(error?.serial?.portOpened){
  const serial=error.serial,text=serial.textTail||'';
  let code='device',title='The serial port opened; the board did not connect',detail=String(error.message);
  if(error.code==='YETI_HANDSHAKE_TIMEOUT'){
   code='firmware';title='USB opened; YetiYell firmware did not reply';
   detail='Connect ESP32 operates a board that already has YetiYell installed. If you have not installed it, go to Set up and use Choose board & flash. If it is already installed, release BOOT, tap EN/RESET, then reconnect. Select the board’s USB-to-UART port, such as CP2102 or CH340, rather than a Bluetooth or audio port.';
   if(/waiting for download|DOWNLOAD[_ (]/i.test(text)){code='bootloader';title='The board is waiting in download mode';detail='The received boot log reports download mode. Release BOOT and try Reset board & reconnect to start the installed firmware. If YetiYell has not been installed, use Set up → Choose board & flash first.';}
   else if(/invalid header|Guru Meditation|Brownout detector|abort\(\) was called|assert failed/i.test(text)){code='boot-error';title='The board reported a boot error';detail='USB data is arriving, but the boot log contains an error and YetiYell did not answer. Save the USB console log. Check the selected board/flash size and power connection before reinstalling the matching firmware.';}
   else if(serial.bytesReceived>0)detail+=' Data was received, but it was not the required YetiYell reply; the captured text is in Connection details.';
   else detail+=' No serial bytes were received during this attempt.';
  }
  return {...status,ok:false,code,title,detail,deviceRecovery:true};
 }
 if(error?.name==='NotFoundError')return {...status,code:'cancelled',title:'No port selected',detail:'The chooser was closed without selecting a port. Click Connect ESP32 again. If its list is empty, use a USB data cable and check the board’s USB-to-UART connector and driver.'};
 if(error?.name==='SecurityError'||error?.name==='NotAllowedError')return {...status,ok:false,code:'permission',title:'The browser blocked the port chooser',detail:'Open YetiYell directly in desktop Chrome or Edge. In the browser’s site settings, allow serial ports to ask for permission. A site or organization policy may also block USB serial access. Then click Connect ESP32 again.'};
 return {...status,ok:false,code:'connection',title:'USB connection did not complete',detail:String(error?.message||error)};
}
