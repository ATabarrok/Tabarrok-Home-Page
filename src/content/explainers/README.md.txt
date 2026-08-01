Explainer pages live here, one markdown file per paper.

The filename must exactly match the `id` of a paper in
src/data/publications.yaml. For example, to write an explainer for:

    - id: two-peas-in-a-pod-democracy-and-capitalism
      title: "Two Peas in a Pod: Democracy and Capitalism"

create `two-peas-in-a-pod-democracy-and-capitalism.md` in this directory:

    ---
    title: Two Peas in a Pod, explained
    description: Why capitalism and democracy reinforce each other.
    updated: 2026-08-01
    ---

    Ordinary markdown from here down.

That is the whole setup. The page appears at
/research/two-peas-in-a-pod-democracy-and-capitalism/ and an "Explainer"
chip shows up next to the paper on /research/.

This file is named .txt so the collection loader ignores it.
