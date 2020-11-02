import React, {useState} from 'react';
import DefaultMenu from './Content/DefaultMenu';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisV } from '@fortawesome/free-solid-svg-icons';

function MainMenu(props) {
    const [isOpen, setIsOpen] = useState(false);
    const menuClass = (isOpen) ? "mainMenuOpen" : "mainMenu";
    const closeMenu = () => {
        setIsOpen(false);
    }
    return (
        <div className={menuClass}>
            <div className="menuIcon" onClick={()=>setIsOpen(!isOpen)}>
                <FontAwesomeIcon
                    icon={faEllipsisV} />
            </div>
            <DefaultMenu closeMenu={()=>closeMenu()} />
        </div>
    )
}

export default MainMenu;