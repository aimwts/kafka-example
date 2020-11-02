import React from "react";

function PageHeader(props) {
    return (
        <header className="main-header">
            <div className="prism-line"></div>
            <div className="content-left">
                <a href="http://swim.ai" target="_blank" rel="noopener noreferrer" className="logoLink">
                    <img src="https://cdn.swim.ai/images/logos/marlin/swim-marlin-logo.svg" alt="swim"/>
                </a>
                <div className="heading">
                    <div className="title">{props.title}</div>
                    <div className="subtitle">{props.subTitle}</div>
                </div>
                <div className="form-select"></div>
            </div>
        </header>
    );
}

export default PageHeader;
