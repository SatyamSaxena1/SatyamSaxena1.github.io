# Satyam Saxena - portfolio

https://satyamsaxena1.github.io/

A neo-futuristic portfolio with a dark and a light theme. The animated background is a single Three.js fragment shader (drifting glowing blobs); everything else is plain HTML, CSS and JavaScript, so it deploys straight to GitHub Pages with no build step.

- `index.html` - landing page with the landmark-projects grid.
- `railway/index.html` - the animated Railway Vision story: timeline, labelling method, screenshots and results.
- `assets/css/theme.css` - the shared design system (dark and light tokens).
- `assets/js/bg.js` - the WebGL background; falls back to CSS gradients without WebGL and holds still for reduced-motion users.
- `assets/js/site.js` - theme toggle, scroll reveals, counters and the screenshot lightbox.
- `assets/story/` - screenshots used on the railway page (cropped and blurred where needed).

Source code for the railway system is proprietary and not published; see the documentation-only project at https://github.com/SatyamSaxena1/railway-overhead-line-detection.
