package model

import (
	"fmt"
	"strings"
	"testing"
)

func TestQueryParams_ParseQueryStr(t *testing.T) {
	q := "修女,洗脑,-触手@tag:内射/中出,circle:青春×フェティシズム,va:陽向葵ゅか,duration:1h,rate:4.75,-price:1000,sell:700,age:adult,-lang:JPN?order=dl_count&sort=desc&page=1&pageSize=20&subtitle=0&includeTranslationWorks=true"
	queryParams := NewQueryParams(q)
	err := queryParams.ParseQueryStr()
	if err != nil {
		t.Fatalf("ParseQueryStr() error = %v, want nil", err)
	}
	str, err := queryParams.BuildAsmrOneQueryStr()
	if err != nil {
		t.Errorf("BuildAsmrOneQueryStr() error = %v, wantErr %v", err, "")
	}
	fmt.Println(str)
	//fmt.Println(queryParams)
}

func TestQueryParams_MultiTags(t *testing.T) {
	q := "耳搔@tag:助眠,tag:掏耳,va:小苺?order=dl_count&sort=desc&page=1&pageSize=20&subtitle=1&includeTranslationWorks=true"
	queryParams := NewQueryParams(q)
	if err := queryParams.ParseQueryStr(); err != nil {
		t.Fatalf("ParseQueryStr() error = %v", err)
	}
	if queryParams.SearchPair == nil || len(queryParams.SearchPair.Tags) != 2 {
		t.Fatalf("expected two tags, got %#v", queryParams.SearchPair)
	}
	str, err := queryParams.BuildAsmrOneQueryStr()
	if err != nil {
		t.Fatalf("BuildAsmrOneQueryStr() error = %v", err)
	}
	if !strings.Contains(str, "tag%3A%E5%8A%A9%E7%9C%A0") || !strings.Contains(str, "tag%3A%E6%8E%8F%E8%80%B3") {
		t.Fatalf("expected encoded query to contain both tags, got %q", str)
	}
}
