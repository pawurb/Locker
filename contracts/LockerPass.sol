// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

interface IERC721 {
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );
    event Approval(
        address indexed owner,
        address indexed approved,
        uint256 indexed tokenId
    );
    event ApprovalForAll(
        address indexed owner,
        address indexed operator,
        bool approved
    );

    function balanceOf(address owner) external view returns (uint256 balance);

    function ownerOf(uint256 tokenId) external view returns (address owner);

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) external;

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function transferFrom(address from, address to, uint256 tokenId) external;

    function approve(address to, uint256 tokenId) external;

    function setApprovalForAll(address operator, bool approved) external;

    function getApproved(
        uint256 tokenId
    ) external view returns (address operator);

    function isApprovedForAll(
        address owner,
        address operator
    ) external view returns (bool);
}

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

contract LockerPass is IERC721 {
    address public admin;
    uint256 public nextId = 0;
    string public name;
    string public symbol;
    mapping(uint256 => bool) public isFrozen;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    error ERC721NonexistentToken(uint256 tokenId);
    error ERC721InvalidReceiver(address receiver);

    modifier requireMinted(uint256 _tokenId) {
        if (_ownerOf(_tokenId) == address(0)) {
            revert ERC721NonexistentToken(_tokenId);
        }
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Access denied!");
        _;
    }

    modifier onlyOwner(uint256 _tokenId) {
        require(_ownerOf(_tokenId) == msg.sender, "Access denied!");
        _;
    }

    constructor(address _admin, string memory _name, string memory _symbol) {
        admin = _admin;
        name = _name;
        symbol = _symbol;
    }

    function balanceOf(address _owner) external view returns (uint256) {
        return _balances[_owner];
    }

    function ownerOf(uint256 _tokenId) external view returns (address) {
        return _ownerOf(_tokenId);
    }

    function _ownerOf(uint256 _tokenId) internal view returns (address) {
        return _owners[_tokenId];
    }

    function mint(address _to) external onlyAdmin {
        _owners[nextId] = _to;
        unchecked {
            _balances[_to] += 1;
        }

        nextId = nextId + 1;
    }

    function burn(uint256 _tokenId) external requireMinted(_tokenId) onlyAdmin {
        address owner = _ownerOf(_tokenId);
        _balances[owner] -= 1;
        _owners[_tokenId] = address(0);
    }

    function approve(
        address _to,
        uint256 _tokenId
    ) external requireMinted(_tokenId) onlyOwner(_tokenId) {
        emit Approval(msg.sender, _to, _tokenId);
        _tokenApprovals[_tokenId] = _to;
    }

    function getApproved(
        uint256 _tokenId
    ) external view requireMinted(_tokenId) returns (address) {
        return _tokenApprovals[_tokenId];
    }

    function setApprovalForAll(address _operator, bool _approved) public {
        emit ApprovalForAll(msg.sender, _operator, _approved);
        _operatorApprovals[msg.sender][_operator] = _approved;
    }

    function isApprovedForAll(
        address _owner,
        address _operator
    ) external view returns (bool) {
        return _operatorApprovals[_owner][_operator];
    }

    function freeze(
        uint256 _tokenId
    ) public requireMinted(_tokenId) onlyOwner(_tokenId) {
        require(isFrozen[_tokenId] == false, "Token is already frozen!");
        isFrozen[_tokenId] = true;
    }

    function transferFrom(address _from, address _to, uint256 _tokenId) public {
        require(!isFrozen[_tokenId], "Token is frozen!");

        if (_to == address(0)) {
            revert ERC721InvalidReceiver(_to);
        }
        _checkAuthorized(msg.sender, _tokenId);

        if (_from != address(0)) {
            unchecked {
                _balances[_from] -= 1;
            }
        }

        if (_to != address(0)) {
            unchecked {
                _balances[_to] += 1;
            }
        }

        emit Transfer(_from, _to, _tokenId);
        _owners[_tokenId] = _to;
    }

    function transferFromAndFreeze(
        address _from,
        address _to,
        uint256 _tokenId
    ) public onlyOwner(_tokenId) {
        transferFrom(_from, _to, _tokenId);
        isFrozen[_tokenId] = true;
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) public {
        _checkOnERC721Received(_from, _to, _tokenId, "");
        transferFrom(_from, _to, _tokenId);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes calldata _data
    ) public {
        _checkOnERC721Received(_from, _to, _tokenId, _data);
        transferFrom(_from, _to, _tokenId);
    }

    function safeTransferFromAndFreeze(
        address _from,
        address _to,
        uint256 _tokenId
    ) external onlyOwner(_tokenId) {
        safeTransferFrom(_from, _to, _tokenId);
        isFrozen[_tokenId] = true;
    }

    function safeTransferFromAndFreeze(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes calldata _data
    ) external onlyOwner(_tokenId) {
        safeTransferFrom(_from, _to, _tokenId, _data);
        isFrozen[_tokenId] = true;
    }

    function _checkAuthorized(
        address _operator,
        uint256 _tokenId
    ) internal view {
        address tokenOwner = _owners[_tokenId];
        bool isOwner = tokenOwner == _operator;
        bool isApproved = _tokenApprovals[_tokenId] == _operator;
        bool approvedForAll = _operatorApprovals[tokenOwner][_operator];
        require(isOwner || isApproved || approvedForAll, "Access denied");
    }

    function _checkOnERC721Received(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    ) private {
        if (_to.code.length > 0) {
            try
                IERC721Receiver(_to).onERC721Received(
                    msg.sender,
                    _from,
                    _tokenId,
                    _data
                )
            returns (bytes4 retval) {
                if (retval != IERC721Receiver.onERC721Received.selector) {
                    revert ERC721InvalidReceiver(_to);
                }
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert ERC721InvalidReceiver(_to);
                } else {
                    /// @solidity memory-safe-assembly
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        }
    }
}
