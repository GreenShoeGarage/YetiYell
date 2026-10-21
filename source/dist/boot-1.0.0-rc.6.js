/* This small, ordinary script still reports failures when the app cannot load. */
(function(){
 var ready=false,timer;
 function show(text){var banner=document.getElementById('startupStatus');if(banner){banner.hidden=false;banner.textContent=text;}}
 function fail(text){clearTimeout(timer);show(text||'YetiYell could not start. Reload the complete server folder and make sure JavaScript files are served as JavaScript.');}
 window.yetiBoot={ready:function(){ready=true;clearTimeout(timer);var b=document.getElementById('startupStatus');if(b)b.hidden=true;},fail:fail};
 window.addEventListener('error',function(e){if(e.target&&e.target.id==='appScript')fail('The app script could not load. Upload the complete server folder, including app.js, and reload.');else if(!ready&&e.message)fail('YetiYell could not start: '+e.message);},true);
 window.addEventListener('unhandledrejection',function(e){if(!ready)fail('YetiYell could not start: '+String(e.reason&&e.reason.message||e.reason));});
 document.addEventListener('click',function(e){if(ready||!e.target.closest('#connectButton, #flashButton'))return;show('The app is still starting or could not load. Wait for the profile list; if it remains empty, reload the complete server folder.');},true);
 if(location.protocol==='file:')show('Open the complete server folder through http://localhost or an HTTPS website. Double-clicking index.html is not supported.');
 timer=setTimeout(function(){if(!ready)fail('YetiYell has not finished loading. Check that app.js and profiles.json are present and reload. Your saved workspace has not been cleared.');},12000);
})();
