/* Global */
let logger;
let deviceController;
let configuration;
let meetingSession;

let audioInputDevices;
let audioOutputDevices;
let videoInputDevices;

/* dat.GUIの設定 */
let chimeCtrl = function(){
  this.audioInput = [];
  this.audioOutput = [];
  this.videoInput = [];
};

/* init */
async function init(joinid) {
  const chimeData = await fetch(`${CHIME_INFO_URL}/?joinid=${joinid}`, {
    method: 'POST',
    mode: 'cors',
  });

  /* body読み込み時もPromiseなので注意 */
  const body = await chimeData.json();
  meetingInfo = body.meeting;
  attendeeInfo = body.attendee;

  const meetingText = document.getElementById('meetingInfo');
  meetingText.value = JSON.stringify(body.meeting, null, '\t');
  const attendeeText = document.getElementById('attendeeInfo');
  attendeeText.value = JSON.stringify(body.attendee, null, '\t');
}

/* HTML読み込み時 */
document.addEventListener('DOMContentLoaded', () => {
  const initButton = document.getElementById('initButton');
  initButton.addEventListener('click', (async()=>{
    const joinForm = document.getElementById('inputForm');
    await init(joinForm.value);
  }));
  const joinButton = document.getElementById('joinButton');
  joinButton.addEventListener('click', (async()=>{
    const meeting = JSON.parse(document.getElementById('meetingInfo').value);
    const attendee = JSON.parse(document.getElementById('attendeeInfo').value);
    await join(meeting, attendee);
  }));
  const leaveButton = document.getElementById('leaveButton');
  leaveButton.addEventListener('click', (async()=>{
    const meeting = JSON.parse(document.getElementById('meetingInfo').value);
    const meetingId = meeting.Meeting.MeetingId;
    const attendee = JSON.parse(document.getElementById('attendeeInfo').value);
    const attendeeId = attendee.Attendee.AttendeeId;
    await leave(meetingId, attendeeId);
  }));
});

/* 会議入室 */
async function join(meeting, attendee) {
  // console.log(meeting);
  // console.log(attendee);

  logger = new ChimeSDK.ConsoleLogger('MyLogger', ChimeSDK.LogLevel.ERROR);
  deviceController = new ChimeSDK.DefaultDeviceController(logger);

  configuration = new ChimeSDK.MeetingSessionConfiguration(meeting, attendee);
  meetingSession = new ChimeSDK.DefaultMeetingSession(configuration, logger, deviceController);

  // input, outputのデバイス取得
  audioInputDevices = await meetingSession.audioVideo.listAudioInputDevices();
  audioOutputDevices = await meetingSession.audioVideo.listAudioOutputDevices();
  videoInputDevices = await meetingSession.audioVideo.listVideoInputDevices();

  // とりあえず一番目のデバイス選択
  // TODO: デバイスの選び方は要検討
  try {
    await meetingSession.audioVideo.chooseVideoInputDevice(videoInputDevices[0].deviceId);
  } catch {
    console.log('choosevideoinput was failed');
  }
  try {
    await meetingSession.audioVideo.chooseAudioInputDevice(audioInputDevices[0].deviceId);
  } catch {
    console.log('chooseaudioinput was failed');
  }
  try {
    await meetingSession.audioVideo.chooseAudioOutputDevice(audioOutputDevices[0].deviceId);
  } catch {
    console.log('choosevideoinput was failed');
  }

  // デバイス切り替え処理用に名前を抽出
  const audioInputDeviceNames = audioInputDevices.map(x => x.label);
  const audioOutputDeviceNames = audioOutputDevices.map(x => x.label);
  const videoInputDeviceNames = videoInputDevices.map(x => x.label);

  // デバイス切り替え
  // TODO: 同じような処理なのでモジュール化する
  const chimeObj = new chimeCtrl();
  const chimeFolder = gui.addFolder('Chime');
  chimeFolder.add(chimeObj, 'audioInput', audioInputDeviceNames).onChange((async()=>{
    const device = audioInputDevices.find(x => x.label === chimeObj.audioInput);
    try {
      await meetingSession.audioVideo.chooseAudioInputDevice(device.deviceId);
    } catch {
      console.log('chooseaudioinput was failed');
    }
  }));

  chimeFolder.add(chimeObj, 'audioOutput', audioOutputDeviceNames).onChange((async()=>{
    const device = audioOutputDevices.find(x => x.label === chimeObj.audioOutput);
    try {
      await meetingSession.audioVideo.chooseAudioOutputDevice(device.deviceId);
    } catch {
      console.log('chooseaudiooutput was failed');
    }
  }));

  chimeFolder.add(chimeObj, 'videoInput', videoInputDeviceNames).onChange((async()=>{
    const device = videoInputDevices.find(x => x.label === chimeObj.videoInput);
    try {
      await meetingSession.audioVideo.chooseVideoInputDevice(device.deviceId);
    } catch {
      console.log('choosevideoinput was failed');
    }
  }));

  chimeFolder.open();

  // 音声のバインド
  const audioElement = document.getElementById('audio-input');
  meetingSession.audioVideo.bindAudioElement(audioElement);

  // Observer設定
  const observer = {
    audiovideoDidStart: () => {
      console.log('start');
    },
    audioVideoDidStop: sessionStatus => {
      // See the "Stopping a session" section for details.
      console.log('Stopped with a session status code: ', sessionStatus.statusCode());
    },
    audioVideoDidStartConnecting: reconnecting => {
      if (reconnecting) {
        // e.g. the WiFi connection is dropped.
        console.log('Attempting to reconnect');
      }
    },
    videoTileDidUpdate: tileState => {
      if (!tileState.boundAttendeeId ) {
        return;
      }
      // TODO: 扱いの違いを考えるとLocalVideoとRemoteVideoは別処理にしたほうがいい
      let videoEl = document.getElementById(`video-${tileState.tileId}`);
      if(videoEl === null) {
        videoEl = document.createElement('video');
        videoEl.id = `video-${tileState.tileId}`;
        const videoSpace = document.getElementById('video-list');
        videoSpace.appendChild(videoEl);
      }
        meetingSession.audioVideo.bindVideoElement(tileState.tileId, videoEl);
    }
  };

  // オブザーバー登録
  meetingSession.audioVideo.addObserver(observer);
  // 通話開始
  meetingSession.audioVideo.start();
  meetingSession.audioVideo.startLocalVideoTile();
}

/* 会議退室 */
async function leave(meeting, attendee) {
  console.log('leave meeting');
  const leaveRes = await fetch(`${CHIME_INFO_URL}/?meeting=${meeting}&attendee=${attendee}`, {
    method: 'DELETE',
    mode: 'cors',
  });
  /* TODO: 切断時の処理 */
}