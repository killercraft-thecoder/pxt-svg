let svg = `
<PATH> <\path>
`

let parser = new SVGParser(svg)
scene.setBackgroundImage(parser.render())