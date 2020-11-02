import React, {useState} from 'react';

function NeonView(props) {
    const [count, setCount] = useState(0);
    return (
        <div id="perspectiveView" className="perspectiveViewMain bg-grey-200 w-full text-center">
            Neon<br/>
            {count}<br/>
            <div className="text-left">
                <h3 onClick={() => setCount(count + 1)}>+</h3>
                <h3 onClick={() => setCount(count - 1)}>-</h3>
            </div>
        </div>
    )
}

export default NeonView;