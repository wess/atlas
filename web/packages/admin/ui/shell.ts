const attribute = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const adminHtml = (basePath: string) => {
  const base = attribute(basePath);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin</title>
  <script>try{var s=localStorage,d=document.documentElement,m=s.getItem("atlas-color-mode"),c=s.getItem("atlas-color-scheme");if(["light","dark","system"].includes(m))d.setAttribute("data-atlas-mode",m);if(["nord","atlas"].includes(c))d.setAttribute("data-atlas-scheme",c)}catch(e){}</script>
  <link rel="stylesheet" href="${base}/assets/entry.css" />
</head>
<body>
  <div id="root" data-base-path="${base}"></div>
  <script type="module" src="${base}/assets/entry.js"></script>
</body>
</html>`;
};
