import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlDock } from './components/ControlDock';
import { HeartCanvas2D } from './components/HeartCanvas2D';
import { HeartCanvas3D } from './components/HeartCanvas3D';
import { LOVE_PHRASES } from './data/translations';

export default function App(){
 const [mode,setMode]=useState<'2d'|'3d'>('3d');
 const [playing,setPlaying]=useState(true);
 const [color,setColor]=useState('#ff668e');
 const [name,setName]=useState('');
 const [message,setMessage]=useState('');
 const [intro,setIntro]=useState(true);
 const phrases=LOVE_PHRASES;
 return <main className="app-shell">
  {intro && <section className="intro"><div className="intro-glow"/><div className="intro-heart">♥</div><h1>Love in Every Language</h1><p>A heart made of words, from every corner of the world.</p><button onClick={()=>setIntro(false)}>Enter Experience</button></section>}
  <header><h1>Love in Every Language</h1><p>A little love, in every language.</p></header>
  <section className="stage">{mode==='3d'?<HeartCanvas3D phrases={phrases} color={color} playing={playing} name={name} message={message}/>:<HeartCanvas2D phrases={phrases} color={color} playing={playing} name={name} message={message}/>}</section>
  <ControlDock mode={mode} setMode={setMode} playing={playing} setPlaying={setPlaying} color={color} setColor={setColor} name={name} setName={setName} message={message} setMessage={setMessage}/>
  <footer>Made with love <span>♥</span> <small>H4CK3R033</small></footer>
 </main>
}