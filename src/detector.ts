import {Tree} from 'index'

interface Score {
  childLenScore: number
  methodScore: number
  domScore: number
}

interface Detected extends Tree {
  score: Score
}

class detector {
  constructor(
    private root: Tree
  ){}

  detect(): Detected[] {
    const trees: Detected[] = []

    return trees
  }

}
