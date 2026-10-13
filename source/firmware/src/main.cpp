#include <Arduino.h>
#include <ArduinoJson.h>
#include <esp_event.h>
#include <esp_netif.h>
#include <NimBLEDevice.h>
#include <esp_wifi.h>
#include "profiles.h"
#include "policy.h"

static const char* VERSION = "1.0.0-rc.1";
static NimBLEAdvertising* advertiser = nullptr;
static bool running = false;
static bool wifiReady = false;
static const Profile* active = nullptr;
static uint32_t began=0, durationMs=0, lastHeartbeat=0, lastStatus=0;
static String line;
static bool overflow=false;
static String runToken;
static String address;

void send(JsonDocument& d) { serializeJson(d,Serial); Serial.println(); }
void ack(uint32_t id,bool ok,const char* error="") {
  StaticJsonDocument<256> d; d["event"]="ack"; d["id"]=id; d["ok"]=ok; if(!ok)d["error"]=error; send(d);
}
void state(const char* event="status",const char* reason="") {
  StaticJsonDocument<512> d;
  d["event"]=event; d["running"]=running;
  d["profile"]=active?active->id:""; d["run"]=runToken;
  d["elapsedMs"]=active?uint32_t(millis()-began):0;
  d["remainingMs"]=running?durationMs-min(durationMs,uint32_t(millis()-began)):0;
  d["mac"]=address; d["reason"]=reason; send(d);
}
void stopRadio(const char* reason) {
  if (advertiser) advertiser->stop();
  if(wifiReady) { esp_wifi_stop(); esp_wifi_set_mode(WIFI_MODE_NULL); }
  bool wasRunning=running; running=false;
  if(wasRunning) state("stopped",reason);
}
void hello(uint32_t id) {
  StaticJsonDocument<4096> d;
  d["event"]="hello"; d["id"]=id; d["app"]="YetiYell"; d["version"]=VERSION; d["protocol"]=1;
  d["chip"]=CONFIG_IDF_TARGET; d["board"]=YETI_BOARD; d["flashBytes"]=ESP.getFlashChipSize(); d["catalog"]=PROFILE_CATALOG; d["capabilities"]="ble,wifi,deadline,heartbeat"; d["running"]=running; d["maxDuration"]=120; d["heartbeatTimeoutMs"]=Policy::heartbeatTimeout;
  JsonArray p=d.createNestedArray("profiles"); for(const auto& v:profiles)p.add(v.id);
  send(d);
}
std::string fromHex(const char* s) {
  std::string out; for(size_t i=0;s[i]&&s[i+1];i+=2) { char b[3]={s[i],s[i+1],0};out.push_back(char(strtoul(b,nullptr,16))); } return out;
}
bool startRadio(const Profile& p,int index,int channel,int power,int interval) {
  if(p.wifi) {
    if(!wifiReady) return false;
    // Configure identity before starting the radio: no default ESP32 beacon can
    // accidentally satisfy an OUI rule during a negative-control test.
    uint8_t mac[6]={0x02,0x59,0x59,0x00,0x00,uint8_t(index+1)};
    if(p.macPrefix[0]) { unsigned a,b,c; if(sscanf(p.macPrefix,"%x:%x:%x",&a,&b,&c)!=3)return false;mac[0]=a;mac[1]=b;mac[2]=c; }
    wifi_config_t config = {};
    memcpy(config.ap.ssid,p.ssid,strlen(p.ssid));
    config.ap.ssid_len=strlen(p.ssid);
    const char* password="YetiYell-Lab-Only";
    memcpy(config.ap.password,password,strlen(password));
    config.ap.channel=channel;config.ap.authmode=WIFI_AUTH_WPA2_PSK;
    config.ap.max_connection=1;config.ap.beacon_interval=100;
    if(esp_wifi_set_mode(WIFI_MODE_AP)!=ESP_OK ||
       esp_wifi_set_mac(WIFI_IF_AP,mac)!=ESP_OK ||
       esp_wifi_set_config(WIFI_IF_AP,&config)!=ESP_OK ||
       esp_wifi_start()!=ESP_OK || esp_wifi_set_max_tx_power(power*4)!=ESP_OK) return false;
    char text[18];snprintf(text,sizeof(text),"%02X:%02X:%02X:%02X:%02X:%02X",mac[0],mac[1],mac[2],mac[3],mac[4],mac[5]);address=text;
  } else {
    uint8_t mac[6]={uint8_t(index+1),0x00,0x00,0x59,0x59,0xC2};
    if(ble_hs_id_set_rnd(mac)!=0) return false;
    NimBLEAdvertisementData data;
    if(p.flags) data.setFlags(0x06);
    if(p.uuid) data.setCompleteServices(NimBLEUUID(p.uuid));
    if(p.uuid128[0]) data.setCompleteServices(NimBLEUUID(p.uuid128));
    if(p.name[0]) data.setName(p.name);
    if(p.mfgHex[0]) data.setManufacturerData(fromHex(p.mfgHex));
    advertiser->setAdvertisementType(BLE_HCI_ADV_TYPE_ADV_NONCONN_IND);
    advertiser->setScanResponse(false);
    advertiser->setAdvertisementData(data);
    advertiser->setMinInterval(uint16_t(interval*1.6f));
    advertiser->setMaxInterval(uint16_t(interval*1.6f));
    esp_power_level_t level=ESP_PWR_LVL_N12;
    if(power==-6)level=ESP_PWR_LVL_N6; if(power==0)level=ESP_PWR_LVL_N0; if(power==3)level=ESP_PWR_LVL_P3;
    NimBLEDevice::setPower(level,ESP_BLE_PWR_TYPE_ADV);
    if(!advertiser->start()) return false;
    char text[18];snprintf(text,sizeof(text),"C2:59:59:00:00:%02X",index+1);address=text;
  }
  return true;
}
void command(const String& text) {
  StaticJsonDocument<768> d;
  if(deserializeJson(d,text)) { ack(0,false,"Invalid JSON");return; }
  uint32_t id=d["id"]|0;
  if(!d["id"].is<uint32_t>() || id==0) { ack(0,false,"Positive command ID required");return; }
  const char* cmd=d["cmd"]|"";
  if(!strcmp(cmd,"hello")) { hello(id);return; }
  if(!strcmp(cmd,"ping")) { lastHeartbeat=millis();ack(id,true);return; }
  if(!strcmp(cmd,"stop")) { stopRadio("user");ack(id,true);return; }
  if(!strcmp(cmd,"status")) { state();ack(id,true);return; }
  if(strcmp(cmd,"start")) { ack(id,false,"Unknown command");return; }
  if(running) { ack(id,false,"Already transmitting; stop the active test first");return; }
  const char* requested=d["profile"]|"";
  int index=-1; for(unsigned i=0;i<PROFILE_COUNT;i++)if(!strcmp(requested,profiles[i].id)){index=i;break;}
  if(index<0){ack(id,false,"Unknown profile");return;}
  const Profile& p=profiles[index];
  int seconds=d["duration"]|-1,channel=d["channel"]|-1,power=d["power"]|999,interval=d["interval"]|-1;
  if(!d["duration"].is<int>() || !d["channel"].is<int>() || !d["power"].is<int>() || !d["interval"].is<int>() ||
    !Policy::validDuration(seconds)||!Policy::validChannel(channel)||!Policy::validPower(p.wifi,power)||!Policy::validInterval(interval)) {
    ack(id,false,"Invalid duration, channel, power, or interval");return;
  }
  const char* token=d["run"]|"";
  if(!token[0]||strlen(token)>64){ack(id,false,"Run token required (1 to 64 characters)");return;}
  stopRadio("replace");
  if(!startRadio(p,index,channel,power,interval)) {stopRadio("radio_error");ack(id,false,"Radio could not start");return;}
  active=&p;runToken=token;began=millis();durationMs=uint32_t(seconds)*1000;lastHeartbeat=began;running=true;
  ack(id,true);state("started");
}
void setup() {
  Serial.begin(115200);line.reserve(768);
  esp_netif_init();esp_event_loop_create_default();
  esp_netif_create_default_wifi_ap();
  wifi_init_config_t wifiConfig=WIFI_INIT_CONFIG_DEFAULT();
  wifiReady=esp_wifi_init(&wifiConfig)==ESP_OK;
  if(wifiReady){esp_wifi_set_storage(WIFI_STORAGE_RAM);esp_wifi_set_mode(WIFI_MODE_NULL);}
  NimBLEDevice::init("YetiYell");
  // Fixed static-random lab identity, little-endian. No vendor OUI masquerading.
  uint8_t randomAddress[6]={0x01,0x00,0x00,0x59,0x59,0xC2};
  ble_hs_id_set_rnd(randomAddress);
  NimBLEDevice::setOwnAddrType(BLE_OWN_ADDR_RANDOM);
  advertiser=NimBLEDevice::getAdvertising();
  delay(100);hello(0);
}
void loop() {
  unsigned count=0;
  while(Serial.available() && count++<256) {
    char c=char(Serial.read());
    if(c=='\n') {if(overflow)ack(0,false,"Command too long");else if(line.length())command(line);line="";overflow=false;}
    else if(c!='\r'&&!overflow) {if(line.length()>=767){overflow=true;line="";}else line+=c;}
  }
  uint32_t now=millis();
  if(running && Policy::expired(now,lastHeartbeat,Policy::heartbeatTimeout))stopRadio("heartbeat_lost");
  if(running && Policy::expired(now,began,durationMs))stopRadio("complete");
  if(running && Policy::expired(now,lastStatus,1000)){lastStatus=now;state();}
  delay(2);
}
