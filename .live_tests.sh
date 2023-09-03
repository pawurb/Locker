echo "Watching files"
fswatch -or contracts test | xargs -n1 -I{} npx hardhat test $1

