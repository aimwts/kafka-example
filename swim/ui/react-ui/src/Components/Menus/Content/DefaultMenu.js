import React from "react";
import { Switch, Route } from "react-router-dom";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobeAmericas, faAtlas, faSatellite } from '@fortawesome/free-solid-svg-icons';

function DefaultMenu(props) {
    return (
        <div className="innerContainer">
            <div className="menuIcons">
                <Link to="/" onClick={props.closeMenu}>
                    <FontAwesomeIcon
                        icon={faAtlas} />
                </Link>
                <Link to="/3dmap" onClick={props.closeMenu}>
                    <FontAwesomeIcon
                        icon={faGlobeAmericas} />

                </Link>
                <Link to="/satellite/27772" onClick={props.closeMenu}>
                    <FontAwesomeIcon
                        icon={faSatellite} />

                </Link>
            </div>
            <h6>Data Filters</h6>
            <div className="dataFilters">
                <select>
                    <option>select</option>
                </select>
            </div>
            <h6>Page Options</h6>
            <div className="pageFilters">
                <Switch>
                    <Route exact path="/">
                        2d map options
                    </Route>
                    <Route path="/3dmap">
                        3d map options
                    </Route>
                </Switch>

            </div>
        </div>
    );
}

export default DefaultMenu;
