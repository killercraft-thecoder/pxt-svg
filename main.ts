namespace userconfig {export const ARCADE_SCREEN_HEIGHT = 320;}

let svg = `

<text> Helo </text>
<text> Helo8 </text>
<text> Helo </text>
<text> Helo2 </text>
<text> Helo45 </text>
<text> Helo2 </text>
<text> Heloh </text>
<text> Helof2 </text>
<text> Helo </text>
<text> Helod2 </text>
<text> Helosd </text>
<text> Helo2dt4 </text>
<text> Helo </text>
<text> Helo8 </text>
<text> Helo </text>
<text> Helo2 </text>
<text> Helo45 </text>
<text> Helo2 </text>
<text> Heloh </text>
<text> Helof2 </text>
<text> Helo </text>
<text> Helod2 </text>
<text> Helosd </text>
<text> Helo2dt4 </text>
`

let parser = new SVGParser(svg)
scene.setBackgroundImage(parser.render())