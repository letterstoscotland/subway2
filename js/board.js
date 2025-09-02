// Minimal, dependency-free logic
(async function(){
  // Helpers
  const $ = sel => document.querySelector(sel);
  const pad = n => String(n).padStart(2,'0');
  const parseHM = (s) => { const [h,m]=s.split(':').map(Number); return h*60+m; };
  const inRange = (mins, start, end) => mins>=start && mins<end;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const tz = 'Europe/London';

  // Load config
  const [messages, schedule, settings] = await Promise.all([
    fetch('config/messages.json').then(r=>r.json()),
    fetch('config/schedule.json').then(r=>r.json()),
    fetch('config/settings.json').then(r=>r.json())
  ]);

  // State
  let aCounter = settings.innerStartOffsetMinutes * 60;
  let bCounter = settings.outerStartOffsetMinutes * 60;
  let aCycle = 0, bCycle = 0;

  // Elements
  const headA_left = $('#headA_left');
  const headA_right = $('#headA_right');
  const headB_left = $('#headB_left');
  const headB_right = $('#headB_right');
  const advA = $('#advA');
  const advB = $('#advB');
  const clock = $('#clock');

  function now(){
    return new Date(new Date().toLocaleString('en-GB',{timeZone:tz}));
  }
  function minsOfDay(d){
    return d.getHours()*60 + d.getMinutes();
  }
  function isSun(d){ return d.getDay()===0; }
  function dayStr(d){ return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]; }

  function serviceRunning(d){
    const m = minsOfDay(d);
    if (isSun(d)) return inRange(m, parseHM(schedule.service.sun.start), parseHM(schedule.service.sun.end));
    return inRange(m, parseHM(schedule.service.mon_sat.start), parseHM(schedule.service.mon_sat.end));
  }
  function cutoffMin(d){
    return isSun(d) ? parseHM(schedule.service.sun.lastApproach) : parseHM(schedule.service.mon_sat.lastApproach);
  }

  function withinTermWindow(d){
    const m = minsOfDay(d), day = dayStr(d);
    const w1 = ['Mon','Tue','Wed','Thu','Fri'].includes(day) && inRange(m, parseHM(schedule.terminations.weekday1.start), parseHM(schedule.terminations.weekday1.end));
    const w2 = ['Mon','Tue','Wed','Thu','Fri'].includes(day) && inRange(m, parseHM(schedule.terminations.weekday2.start), parseHM(schedule.terminations.weekday2.end));
    const sun = day==='Sun' && inRange(m, parseHM(schedule.terminations.sunday.start), parseHM(schedule.terminations.sunday.end));
    return w1 || w2 || sun;
  }

  function footballActive(d){
    const day = dayStr(d);
    const month = months[d.getMonth()];
    if (day!=='Sat') return false;
    if (!schedule.football.monthsInSeason.includes(month)) return false;
    const m = minsOfDay(d);
    return inRange(m, parseHM(schedule.football.start), parseHM(schedule.football.end));
  }

  function cycle(head, counter, leftEl, rightEl, cycleIdx){
    const d = now();
    const m = minsOfDay(d);

    if (!serviceRunning(d)){
      leftEl.textContent = head + ' service complete';
      rightEl.textContent = '';
      leftEl.classList.remove('flashing');
      return [counter, cycleIdx];
    }

    if (counter > 0){
      if (counter <= settings.approachingSeconds){
        leftEl.textContent = head + ' approaching';
        leftEl.classList.add('flashing');
        rightEl.textContent = '';
      } else {
        leftEl.textContent = head + ' next arrival';
        leftEl.classList.remove('flashing');
        rightEl.textContent = Math.ceil(counter/60) + 'min';
      }
      counter--;
    } else {
      counter = settings.headlineCycleMinutes * 60;
      cycleIdx++;
    }

    if (m >= cutoffMin(d) && counter <= settings.approachingSeconds){
      leftEl.textContent = head + ' service complete';
      rightEl.textContent = '';
      leftEl.classList.remove('flashing');
      return [counter, cycleIdx];
    }
    return [counter, cycleIdx];
  }

  function rotateAdvisories(){
    const d = now();
    let listA = messages.advisoriesBase.slice();
    let listB = messages.advisoriesBase.slice();
    if (footballActive(d)){
      listA.push(messages.football);
      listB.push(messages.football);
    }
    if (withinTermWindow(d)){
      if (aCycle % 3 === 2) listA.push(messages.terminations.inner);
      if (bCycle % 3 === 2) listB.push(messages.terminations.outer);
    }
    const idx = Math.floor(Date.now()/10000);
    const msgA = listA[idx % listA.length];
    const msgB = listB[idx % listB.length];

    setAdv(advA, msgA);
    setAdv(advB, msgB);
  }

  function setAdv(el, msg){
    el.textContent = msg;
    const scroller = el.closest('.scroll');
    const marquee = el.closest('.marquee');
    if (scroller.scrollWidth > marquee.clientWidth){
      scroller.style.animation = `scroll-left var(--marqueeSpeed, ${settings.marqueeSpeedSeconds}s) linear infinite`;
    } else {
      scroller.style.animation = 'none';
    }
  }

  function updateClock(){
    const d = now();
    clock.textContent = 'Time Now ' + [
      pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())
    ].join(':');
  }

  // Kick-off
  document.documentElement.style.setProperty('--marqueeSpeed', settings.marqueeSpeedSeconds + 's');

  setInterval(()=>{
    [aCounter, aCycle] = cycle('Inner', aCounter, headA_left, headA_right, aCycle);
    [bCounter, bCycle] = cycle('Outer', bCounter, headB_left, headB_right, bCycle);
    rotateAdvisories();
    updateClock();
  }, 1000);

  // Initial paint
  rotateAdvisories();
  updateClock();
})();