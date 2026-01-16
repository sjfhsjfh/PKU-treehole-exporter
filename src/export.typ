#import "@preview/ourchat:0.2.2" as oc
#import oc.themes: qqnt

#let data = json("data.json")

#let user-colormap = (
  data
    .users
    .enumerate()
    .map(((idx, name)) => {
      let c = color.map.rainbow.at(calc.rem-euclid(idx * 41, 256)).darken(15%)
      (name, c)
    })
    .to-dict()
)

#let users = (
  data
    .users
    .map(name => (
      name,
      qqnt.user(
        name: [#name],
        avatar: circle(
          fill: user-colormap.at(name),
          text(white)[#name.clusters().first()],
        ),
      ),
    ))
    .to-dict()
)

#set page(margin: 0pt, width: auto, background: none)
#set text(font: "Source Han Sans SC")

#qqnt.chat(
  theme: "dark",
  oc.message(
    left,
    users.at("洞主"),
    merge: true,
    [#data.post.text],
  ),
  ..data.comments.map(c => oc.message(
    left,
    users.at(c.name),
    merge: true,
    {
      let msg-quote = c.quote
      if msg-quote != none {
        block(
          inset: (left: 0.6em, right: 0.4em, y: 0.2em),
          stroke: (left: white.darken(20%)),
          text(white.darken(20%), msg-quote.text),
        )
        [@#msg-quote.name_tag ]
      }
      [#c.text]
    },
  )),
)
