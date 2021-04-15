

const path = require("path")
const fs = require("fs")
const parse = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require('@babel/core')

function moudleOpt(fileName) {

    const content = fs.readFileSync(fileName, 'utf-8')
    // 把内容转换成 AST
    const ast = parse.parse(content, {
        sourceType: 'module'
    })

    const dep = {};
    // 遍历ast 节点
    traverse(ast, {
        // 导出 imprt 这样的预发
        ImportDeclaration({ node }) {
            const dirName = path.dirname(fileName)
            const newFile = './' + path.join(dirName, node.source.value)
            dep[node.source.value] = newFile
        }
    });

    // 把 AST 转化成 浏览器可识别的代码
    // const { code } = babel.transformFromAst(ast, null, {
    //     presets: ["@babel/preset-env"]
    // });

    const { code } = babel.transformFromAstSync(ast, null, {
        presets: ["@babel/preset-env"]
    });
    // console.log('content', ast.program.body);

    return {
        fileName,
        dep,
        code
    }
}


// 构建依赖图
function makeDep(entry) {
    const dep = moudleOpt(entry);

    const depArr = [dep];

    for (let i = 0; i < depArr.length; i++) {
        const temp = depArr[i].dep;
        for (let i in temp) {
            const tempDep = moudleOpt(temp[i]);
            depArr.push(tempDep)
        }
    }

    const graph = {};
    depArr.forEach(item => {
        graph[item.fileName] = {
            dep: item.dep,
            code: item.code
        }
    })

    return graph

}

function generatorCode(entry) {
    const graph = JSON.stringify(makeDep(entry))
    return `(function(graph){
                 //加载模块 执行 code
                 // require 函数的目的就是为了执行 code 自己定义的require
                 function require(module){
                    //闭包中执行
                    function localRequire(relativePath){
                        return require(graph[module].dep[relativePath])
                    }
                    let exports = {};
                    (function(require, exports, code){
                      // eval code 的时候 浏览器不识别 export require 函数
                      eval(code)
                    })(localRequire, exports, graph[module].code)
                    return exports
                 }
                 require('${entry}')
            })(${graph})`
}

console.log(generatorCode("./src/index.js"));