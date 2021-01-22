import React, { Component } from 'react';

import commentIcon from './img/icons/poi-comment.png';


class NewCommentCursor extends Component {
    constructor() {
        super();

        this.onMouseMove = this.onMouseMove.bind(this);
        document.addEventListener('mousemove', this.onMouseMove);

        this.state = {
            x: 0,
            y: 0
        }
    }

    componentWillUnmount() {
        document.removeEventListener('mousemove', this.onMouseMove);
    }

    onMouseMove(e) {
        const x = e.clientX;
        const y = e.clientY;
        this.setState({ x, y });
    }

    render() {
        return (
            <div
                className="fixed pointer-events-none top-0 left-0 w-full"
                style={{
                    transform: `translate(${this.state.x}px, ${this.state.y}px)`
                }}>
                <img
                    className="absolute" alt=""
                    src={commentIcon}
                    style={{
                        left: -16,
                        top: -20,
                        animation: 'bounceAndGlow 0.4s ease-out infinite alternate'
                    }}
                    />
            </div>
        )
    }
}

export default NewCommentCursor;