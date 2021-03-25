// Queue data structure

class Queue {
    // Instantiate array
    constructor() {
        this.elements = []
    }

    // Add to queue
    enqueue(element) {
        this.elements.push(element)
    }

    // Remove from queue
    dequeue() {
        return this.elements.shift()
    }

    // Return next element to be removed
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