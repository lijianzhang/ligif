# 编译
EXAMPLE=true npx vite build 

# 进入编译的目录 
cd example/dist

# 配置 git 初始化信息
git init


git add .

git commit -m '发布例子'

git remote add origin git@github.com:lijianzhang/ligif.git
git checkout -b gh-pages
git push -f --set-upstream origin gh-pages