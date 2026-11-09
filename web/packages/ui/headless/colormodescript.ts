// paste into <head> so a saved choice applies before first paint, not when react mounts.
// no react here, so html shells can use it without loading the component code.
export const colorModeScript = `<script>try{var s=localStorage,d=document.documentElement,m=s.getItem("atlas-color-mode"),c=s.getItem("atlas-color-scheme");if(["light","dark","system"].includes(m))d.setAttribute("data-atlas-mode",m);if(["nord","atlas"].includes(c))d.setAttribute("data-atlas-scheme",c)}catch(e){}</script>`;
