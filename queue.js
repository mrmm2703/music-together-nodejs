// Queue data structure
class Queue {
    // Instantiate array
    constructor() {
        this.elements = []
    }

    enqueue(element) {
        this.elements.push(element)
    }

    dequeue() {
        return this.elements.shift()
    }

    peek() {
        if (this.isEmpty()) {
            return undefined
        } else {
            return this.elements[0]
        }
    }

    isEmpty() {
        return this.elements.length == 0
    }

    length() {
        return this.elements.length
    }
}

module.exports = Queue